import { Notification, INotification } from '../models/Notification';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';
import EmailService from './email.service';
import telegramService from './telegram.service';
import firebaseService from './firebase.service';

export const notificationEvents = new EventEmitter();

export class NotificationService {
  private io: SocketServer | null = null;
  // Track whether we've already subscribed to notificationEvents
  private static listenerRegistered = false;
  // Track processed notification events to avoid duplicate sends
  private static processedNotificationIds = new Set<string>();
  // Track processed notifications per transaction and type to avoid duplicate TX notifications
  private static processedTransactionTypeKeys = new Set<string>();

  constructor() {
    // Register event listener only once
    if (!NotificationService.listenerRegistered) {
      notificationEvents.on('notification:created', this.handleNotificationCreated.bind(this));
      NotificationService.listenerRegistered = true;
    }
  }

  setSocketServer(io: SocketServer) {
    this.io = io;
  }

  private async handleNotificationCreated(notification: INotification) {
    // Deduplicate event handling
    const notifId = notification._id.toString();
    if (NotificationService.processedNotificationIds.has(notifId)) {
      logger.info(`Skipping duplicate event handling for notification ${notifId}`);
      return;
    }
    NotificationService.processedNotificationIds.add(notifId);
    // Transaction-level dedupe: skip if already processed
    if (notification.relatedTo?.model === 'Transaction') {
      const key = `${notification.relatedTo.id.toString()}:${notification.type}`;
      if (NotificationService.processedTransactionTypeKeys.has(key)) {
        logger.info(`Skipping duplicate transaction notification for ${key}`);
        return;
      }
      NotificationService.processedTransactionTypeKeys.add(key);
    }
    try {
      // Log detailed notification information
      logger.info(`Processing notification for user ${notification.recipient}`, {
        notificationType: notification.type,
        relatedModel: notification.relatedTo?.model,
        relatedId: notification.relatedTo?.id,
        title: notification.title
      });

      if (notification.type === 'system_notification' && notification.relatedTo?.model === 'Transaction') {
        logger.info(`Processing transaction notification`, {
          transactionId: notification.relatedTo.id,
          metadata: notification.metadata
        });
      }

      // Emit to connected socket if available
      if (this.io) {
        this.io.to(`user:${notification.recipient}`).emit('notification:new', notification);
        logger.info(`Emitted notification to socket for user ${notification.recipient}`);
      }

      // Get the user to check notification preferences - explicitly select telegramNotifications and notifications
      const user = await User.findById(notification.recipient).select('notifications telegramNotifications devices email fullName');
      if (!user) {
        logger.warn(`User not found for notification: ${notification.recipient}`);
        return;
      }

      // Log the user's notification preferences for debugging
      logger.info(`Retrieved user for notification: ${notification.recipient}`, {
        hasUser: !!user,
        hasTelegramNotifications: !!user.telegramNotifications,
        telegramEnabled: user.telegramNotifications?.enabled,
        telegramUsername: user.telegramNotifications?.username,
        telegramId: user.telegramNotifications?.telegramId
      });

      logger.info(`User notification preferences`, {
        userId: user._id,
        pushEnabled: user.notifications.push,
        emailEnabled: user.notifications.email,
        telegramEnabled: user.telegramNotifications?.enabled,
        telegramUsername: user.telegramNotifications?.username,
        telegramId: user.telegramNotifications?.telegramId
      });

      // Send push notification if user has enabled them
      if (user.notifications.push) {
        logger.info(`Sending push notification to user ${user._id}`);
        await this.sendPushNotification(notification);
      }

      // Send email notification if user has enabled them
      if (user.notifications.email) {
        logger.info(`Sending email notification to user ${user._id}`);
        await this.sendEmailNotification(notification, user);
      }

      // Send Telegram notification if user has enabled them
      if (user.telegramNotifications?.enabled) {
        logger.info(`Sending Telegram notification to user ${user._id}`, {
          telegramUsername: user.telegramNotifications.username,
          telegramId: user.telegramNotifications.telegramId
        });
        await this.sendTelegramNotification(notification, user);
      } else {
        logger.info(`Telegram notifications not enabled for user ${user._id}`);
      }

    } catch (error) {
      logger.error('Error handling notification creation:', error);
    }
  }

  public async sendPushNotification(notification: INotification) {
    try {
      const user = await User.findById(notification.recipient);
      if (!user) return;

      // Check if push notifications are enabled for this user
      if (!user.notifications.push) {
        logger.info(`Push notifications disabled for user ${user._id}`);
        return;
      }

      // Check if the user has any devices with push tokens
      const devicesWithPushTokens = user.devices?.filter(device => device.pushToken);

      if (!devicesWithPushTokens || devicesWithPushTokens.length === 0) {
        logger.info(`No push-enabled devices found for user ${user._id}`);
        return;
      }

      // Extract push tokens from devices and filter out undefined values
      const pushTokens = devicesWithPushTokens
        .map(device => device.pushToken)
        .filter((token): token is string => token !== undefined && token !== null);

      // If no valid tokens, exit early
      if (pushTokens.length === 0) {
        logger.info(`No valid push tokens found for user ${user._id}`);
        return;
      }

      // Check notification type to determine if it should be sent
      let shouldSend = true;

      // Get user's push notification preferences
      const preferences = {
        transactions: true,
        transactionUpdates: true,
        purchaseConfirmations: true,
        saleConfirmations: true,
        security: true
      };

      if (notification.type === 'system_notification' && notification.relatedTo?.model === 'Transaction') {
        // For transaction notifications, check specific transaction preferences
        const metadata = notification.metadata || {};

        if (metadata.transactionType === 'BUY_MYPTS' && !preferences.purchaseConfirmations) {
          shouldSend = false;
        } else if (metadata.transactionType === 'SELL_MYPTS' && !preferences.saleConfirmations) {
          shouldSend = false;
        } else if (!preferences.transactions) {
          shouldSend = false;
        }
      } else if (notification.type === 'security_alert' && !preferences.security) {
        shouldSend = false;
      }

      if (!shouldSend) {
        logger.info(`Push notification type ${notification.type} disabled for user ${user._id}`);
        return;
      }

      // Declare result container for firebase response
      let result: { success: number; failure: number; invalidTokens: string[] };

      // Send notification based on type
      if (notification.type === 'system_notification' && notification.relatedTo?.model === 'Transaction' && notification.metadata) {
        // For transaction notifications, send multicast with transaction metadata
        const data: Record<string, string> = {
          notificationType: notification.type,
          notificationId: notification._id.toString(),
          relatedModel: notification.relatedTo.model,
          relatedId: notification.relatedTo.id.toString(),
          transactionType: notification.metadata.transactionType || 'Transaction',
          amount: `${notification.metadata.amount || 0}`,
          status: notification.metadata.status || 'Unknown'
        };
        result = await firebaseService.sendMulticastPushNotification(
          pushTokens,
          notification.title,
          notification.message,
          data
        );
      } else {
        // For other notifications, use the standard template
        // Create data object with proper type definition
        const data: {
          notificationType: string;
          notificationId: string;
          clickAction: string;
          url: string;
          timestamp: string;
          relatedModel?: string;
          relatedId?: string;
        } = {
          notificationType: notification.type,
          notificationId: notification._id ? notification._id.toString() : '',
          clickAction: notification.action?.url ? 'OPEN_URL' : 'OPEN_APP',
          url: notification.action?.url || '',
          timestamp: Date.now().toString()
        };

        if (notification.relatedTo) {
          data.relatedModel = notification.relatedTo.model;
          data.relatedId = notification.relatedTo.id.toString();
        }

        result = await firebaseService.sendMulticastPushNotification(
          pushTokens,
          notification.title,
          notification.message,
          data
        );
      }

      // Handle invalid tokens
      if (result.invalidTokens.length > 0) {
        logger.info(`Found ${result.invalidTokens.length} invalid push tokens for user ${user._id}`);

        // Remove invalid tokens from user's devices
        await User.updateOne(
          { _id: user._id },
          {
            $pull: {
              devices: {
                pushToken: { $in: result.invalidTokens }
              }
            }
          }
        );
      }

      logger.info(`Push notification sent to ${result.success} devices for user ${user._id}`);
    } catch (error) {
      logger.error('Error sending push notification:', error);
    }
  }

  private async sendEmailNotification(notification: INotification, user: any) {
    try {
      if (!user.email) {
        logger.info(`No email found for user ${user._id}`);
        return;
      }

      // Check if email notifications are enabled for this user
      if (!user.notifications.email) {
        logger.info(`Email notifications disabled for user ${user._id}`);
        return;
      }

      // Check notification type to determine email template and content
      let emailSubject = notification.title;
      let emailTemplate = 'notification-email';
      let templateData: any = {
        title: notification.title,
        message: notification.message,
        actionUrl: notification.action?.url || '',
        actionText: notification.action?.text || '',
        action: notification.action || {},
        metadata: notification.metadata || {},
        appName: 'MyPts',
        year: new Date().getFullYear(),
        baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        unsubscribeToken: user.unsubscribeToken || '',
        recipientName: user.fullName || user.firstName || 'User',
        formatDateTime: (dateString: string) => {
          if (!dateString) return '';
          const date = new Date(dateString);
          return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      };

      // For connection requests, use the specialized connection template
      if (notification.metadata?.connectionType || notification.metadata?.connectionReason || notification.metadata?.source) {
        emailTemplate = 'connection-request';
        emailSubject = `New Connection Request - ${notification.title}`;
      }
      // For booking requests, use the event notification template
      else if (notification.type === 'booking_request') {
        emailTemplate = 'event-notification';
        emailSubject = `New Booking Request - ${notification.title}`;
        
        // Access the nested metadata structure correctly
        let bookingData = notification.metadata?.metadata || notification.metadata;
        
        // Convert MongooseMap to plain object
        if (bookingData && bookingData.constructor && bookingData.constructor.name === 'MongooseMap') {
          bookingData = Object.fromEntries(bookingData);
        }
        
        console.log('=== BOOKING DATA AFTER MAP CONVERSION ===');
        console.log(JSON.stringify(bookingData, null, 2));
        
        // Format location properly
        let locationString = null;
        if (bookingData?.location) {
          if (typeof bookingData.location === 'string') {
            locationString = bookingData.location;
          } else if (bookingData.location.name || bookingData.location.address) {
            const parts = [];
            if (bookingData.location.name) parts.push(bookingData.location.name);
            if (bookingData.location.address) parts.push(bookingData.location.address);
            locationString = parts.join(', ');
          }
        }
        
        templateData.event = {
          name: bookingData?.service?.name || bookingData?.itemTitle || 'Service Booking',
          type: 'BOOKING',
          icon: '📋',
          startTime: bookingData?.startTime ? templateData.formatDateTime(bookingData.startTime) : null,
          endTime: bookingData?.endTime ? templateData.formatDateTime(bookingData.endTime) : null,
          location: locationString,
          organizer: bookingData?.requester?.name || null,
          participants: null,
          duration: bookingData?.service?.duration || bookingData?.duration || null,
          description: bookingData?.description || null,
          status: bookingData?.status || 'pending'
        };
        
        console.log('=== FINAL TEMPLATE DATA EVENT ===');
        console.log(JSON.stringify(templateData.event, null, 2));
        
        templateData.greeting = `Hello ${templateData.recipientName},`;
        templateData.description = `You have received a new booking request. Here are the details:`;
        templateData.actions = [
          {
            text: notification.action?.text || 'View Booking',
            url: notification.action?.url || '#',
            secondary: false
          }
        ];
        // Keep metadata for any additional template logic
        templateData.metadata = {
          ...bookingData,
          eventType: 'booking',
          notificationType: 'request'
        };
      }
      // For events and bookings, use the specialized event template
      else if (notification.metadata?.eventType || notification.metadata?.eventName || notification.metadata?.eventDate || notification.metadata?.bookingId) {
        emailTemplate = 'event-notification';
        emailSubject = notification.metadata?.eventType === 'booking' ? 
          `Booking Notification - ${notification.title}` : 
          `Event Notification - ${notification.title}`;
      }
      // For reminder notifications, use specific templates
      else if (notification.type === 'reminder') {
        const reminderType = notification.metadata?.reminderType;
        const relatedModel = notification.relatedTo?.model;
        
        if (relatedModel === 'Task') {
          emailTemplate = 'task-reminder';
          emailSubject = `Task Reminder: ${notification.metadata?.itemTitle || notification.title}`;
        } else if (relatedModel === 'Event') {
          // Check if this is a booking event
          if (notification.metadata?.eventType === 'booking' || notification.metadata?.eventType === 'Booking') {
            emailTemplate = 'event-notification';
            emailSubject = `Booking Reminder: ${notification.metadata?.itemTitle || notification.title}`;
          } else {
            emailTemplate = 'event-notification';
            emailSubject = `Event Reminder: ${notification.metadata?.itemTitle || notification.title}`;
          }
        } else if (relatedModel === 'Booking') {
          emailTemplate = 'event-notification';
          emailSubject = `Booking Reminder: ${notification.metadata?.itemTitle || notification.title}`;
        } else {
          // Fallback to general reminder template
          emailTemplate = 'general-reminder';
          emailSubject = `Reminder: ${notification.metadata?.itemTitle || notification.title}`;
        }
      }
      // For transaction notifications, use specific templates based on transaction type
      else if (notification.type === 'system_notification' && notification.relatedTo?.model === 'Transaction') {
        templateData.transactionId = notification.relatedTo.id;
        templateData.metadata = notification.metadata || {};

        // Add timestamp if not present
        if (!templateData.metadata.timestamp) {
          templateData.metadata.timestamp = new Date().toISOString();
        }

        // Choose template based on transaction type
        if (templateData.metadata.transactionType === 'BUY_MYPTS') {
          emailTemplate = 'purchase-confirmation-email';
          emailSubject = 'Purchase Confirmation - MyPts';
        } else if (templateData.metadata.transactionType === 'SELL_MYPTS') {
          emailTemplate = 'sale-confirmation-email';
          emailSubject = 'Sale Confirmation - MyPts';
        } else {
          emailTemplate = 'transaction-notification';
        }
      } else if (notification.type === 'security_alert') {
        emailTemplate = 'security-alert-email';
        templateData.metadata = notification.metadata || {};

        // Add timestamp if not present
        if (!templateData.metadata.timestamp) {
          templateData.metadata.timestamp = new Date().toISOString();
        }
      }

      // Load and compile the template
      try {
        const template = await EmailService.loadAndCompileTemplate(emailTemplate);
        const emailContent = template(templateData);

        // Send the email
        await EmailService.sendEmail(user.email, emailSubject, emailContent);
        logger.info(`Email notification sent to ${user.email} using template ${emailTemplate}`);
      } catch (templateError) {
        // Fallback to a simple email if template fails
        logger.error(`Error with email template ${emailTemplate}, falling back to simple email: ${templateError}`);
        await EmailService.sendAdminNotification(
          user.email,
          emailSubject,
          `<p>${notification.message}</p>` +
          (notification.action ? `<p><a href="${notification.action.url}">${notification.action.text}</a></p>` : '')
        );
      }
    } catch (error) {
      logger.error('Error sending email notification:', error);
    }
  }

  private async sendTelegramNotification(notification: INotification, user: any) {
    logger.info(`Attempting to send Telegram notification for user ${user._id}`, {
      notificationType: notification.type,
      relatedModel: notification.relatedTo?.model,
      relatedId: notification.relatedTo?.id,
      userTelegramSettings: user.telegramNotifications || 'Not available'
    });
    const metadataMap: Map<string, any> = notification.metadata instanceof Map
      ? notification.metadata
      : new Map(Object.entries(notification.metadata || {}));
    try {
      // Double-check if telegramNotifications is available
      if (!user.telegramNotifications) {
        logger.error(`Telegram notifications object not available for user ${user._id} - trying to reload user`);
        // Try to reload the user with explicit selection of telegramNotifications
        user = await User.findById(user._id).select('+telegramNotifications');

        if (!user || !user.telegramNotifications) {
          logger.error(`Failed to reload user ${user._id} with telegramNotifications`);
          return;
        }

        logger.info(`Successfully reloaded user ${user._id} with telegramNotifications`, {
          telegramEnabled: user.telegramNotifications.enabled,
          telegramUsername: user.telegramNotifications.username,
          telegramId: user.telegramNotifications.telegramId
        });
      }

      if (!user.telegramNotifications?.enabled) {
        logger.info(`Telegram notifications not enabled for user ${user._id}`);
        return;
      }

      // Check for either username or telegramId
      if (!user.telegramNotifications?.username && !user.telegramNotifications?.telegramId) {
        logger.info(`No Telegram username or ID set for user ${user._id}`);
        return;
      }

      // Prefer telegramId if available, otherwise use username
      const telegramId = user.telegramNotifications.telegramId;
      const telegramUsername = user.telegramNotifications.username;

      // Double-check that we have at least one valid recipient
      if (!telegramId && !telegramUsername) {
        logger.warn(`User ${user._id} has Telegram notifications enabled but no recipient information`);
        return;
      }

      const telegramRecipient = telegramId || telegramUsername;

      logger.info(`User ${user._id} has Telegram notifications enabled with recipient: ${telegramRecipient}`, {
        telegramId,
        telegramUsername,
        telegramEnabled: user.telegramNotifications.enabled,
        telegramPreferences: user.telegramNotifications.preferences
      });

      logger.info(`Preparing to send Telegram notification to user ${user._id} via ${telegramId ? 'ID: ' + telegramId : '@' + telegramUsername}`);

      // Check if this notification type is enabled for Telegram
      const preferences = user.telegramNotifications.preferences || {
        transactions: true,
        transactionUpdates: true,
        purchaseConfirmations: true,
        saleConfirmations: true,
        security: true,
        connectionRequests: false,
        messages: false
      };

      logger.info(`User ${user._id} Telegram preferences: ${JSON.stringify(preferences)}`);

      // Check notification type to determine if it should be sent
      let shouldSend = true;

      if (notification.type === 'system_notification' && notification.relatedTo?.model === 'Transaction') {
        // For transaction notifications, check specific transaction preferences
        const txType = metadataMap.get('transactionType') || 'Transaction';
        const txAmount = metadataMap.get('amount') || 0;
        const txBalance = metadataMap.get('balance') || 0;
        const txStatus = metadataMap.get('status') || 'Unknown';

        if (txType === 'BUY_MYPTS' && !preferences.purchaseConfirmations) {
          logger.info(`Purchase confirmations disabled for user ${user._id}`);
          shouldSend = false;
        } else if (txType === 'SELL_MYPTS' && !preferences.saleConfirmations) {
          logger.info(`Sale confirmations disabled for user ${user._id}`);
          shouldSend = false;
        } else if (!preferences.transactions) {
          logger.info(`Transaction notifications disabled for user ${user._id}`);
          shouldSend = false;
        } else {
          // Default to true for transaction notifications
          logger.info(`Transaction notifications enabled for user ${user._id}`);
          shouldSend = true;
        }
      } else if (notification.type === 'security_alert' && !preferences.security) {
        logger.info(`Security alerts disabled for user ${user._id}`);
        shouldSend = false;
      }

      if (!shouldSend) {
        logger.info(`Telegram notification type ${notification.type} disabled for user ${user._id}`);
        return;
      }

      logger.info(`Proceeding to send Telegram notification to ${telegramId ? 'ID: ' + telegramId : '@' + telegramUsername}`);

      // Send notification based on type
      if (notification.type === 'system_notification' && notification.relatedTo?.model === 'Transaction' && notification.metadata) {
        logger.info(`Sending transaction notification via Telegram to ${telegramRecipient}`);
        logger.info(`Transaction metadata: ${JSON.stringify(Object.fromEntries(metadataMap))}`);

        const transactionId = notification.relatedTo.id.toString();

        // Use the action URL if provided, otherwise construct one
        let transactionDetailUrl;
        if (notification.action?.url) {
          // Use the provided URL but ensure it has https:// prefix
          transactionDetailUrl = notification.action.url.startsWith('http')
            ? notification.action.url
            : `https://${notification.action.url}`;
        } else {
          // Construct a URL with the proper base URL
          const baseUrl = process.env.CLIENT_URL || "https://my-pts-dashboard-management.vercel.app";
          // Ensure the base URL has the https:// prefix
          const formattedBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
          transactionDetailUrl = `${formattedBaseUrl}/dashboard/transactions/${transactionId}`;
        }

        logger.info(`Transaction detail URL for notification: ${transactionDetailUrl}`);

        // Extract values from metadata map
        const txType = metadataMap.get('transactionType') || 'Transaction';
        const txAmount = metadataMap.get('amount') || 0;
        const txBalance = metadataMap.get('balance') || 0;
        const txStatus = metadataMap.get('status') || 'Unknown';
        const result = await telegramService.sendTransactionNotification(
          telegramRecipient,
          notification.title,
          notification.message,
          {
            id: transactionId,
            type: txType,
            amount: txAmount,
            balance: txBalance,
            status: txStatus
          },
          transactionDetailUrl
        );

        logger.info(`Transaction notification result: ${result ? 'Success' : 'Failed'}`);
      } else {
        logger.info(`Sending standard notification via Telegram to ${telegramRecipient}`);

        const result = await telegramService.sendNotification(
          telegramRecipient,
          notification.title,
          notification.message,
          notification.action?.url,
          notification.action?.text
        );

        logger.info(`Standard notification result: ${result ? 'Success' : 'Failed'}`);
      }

      logger.info(`Telegram notification sent to ${telegramId ? 'ID: ' + telegramId : '@' + telegramUsername}`);
    } catch (error) {
      logger.error('Error sending Telegram notification:', error);
    }
  }

  async createNotification(data: Partial<INotification | any>) {
    try {
      const notification = await Notification.create(data);
      notificationEvents.emit('notification:created', notification);
      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: mongoose.Types.ObjectId, query: {
    isRead?: boolean;
    isArchived?: boolean;
    limit?: number;
    page?: number;
  }) {
    try {
      const { isRead, isArchived = false, limit = 10, page = 1 } = query;

      const filter: any = {
        recipient: userId,
        isArchived,
      };

      if (typeof isRead === 'boolean') {
        filter.isRead = isRead;
      }

      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments(filter);

      return {
        notifications,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit,
        },
      };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
    }
  }

  async markAsRead(notificationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
    try {
      return Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true },
        { new: true }
      );
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(userId: mongoose.Types.ObjectId) {
    try {
      return Notification.updateMany(
        { recipient: userId, isRead: false },
        { isRead: true }
      );
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  }

  async archiveNotification(notificationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
    try {
      return Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isArchived: true },
        { new: true }
      );
    } catch (error) {
      logger.error('Error archiving notification:', error);
    }
  }

  async deleteNotification(notificationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
    try {
      return Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
    } catch (error) {
      logger.error('Error deleting notification:', error);
    }
  }

  // Helper method to create common notification types
  async createProfileViewNotification(profileId: mongoose.Types.ObjectId, viewerId: mongoose.Types.ObjectId, profileOwnerId: mongoose.Types.ObjectId) {
    try {
      const viewer:any = await User.findById(viewerId).select('firstName lastName');
      if (!viewer) return;

      return this.createNotification({
        recipient: profileOwnerId,
        type: 'profile_view',
        title: 'New Profile View',
        message: `${viewer.firstName} ${viewer.lastName} viewed your profile`,
        relatedTo: {
          model: 'Profile',
          id: profileId,
        },
        priority: 'low',
      });
    } catch (error :any) {
      logger.error('Error creating profile view notification:', error);
    }
  }

  async createConnectionRequestNotification(requesterId: mongoose.Types.ObjectId, recipientId: mongoose.Types.ObjectId) {
    try {
      const requester:any = await User.findById(requesterId).select('firstName lastName');
      if (!requester) return;

      return this.createNotification({
        recipient: recipientId,
        type: 'connection_request',
        title: 'New Connection Request',
        message: `${requester.firstName} ${requester.lastName} wants to connect with you`,
        relatedTo: {
          model: 'User',
          id: requesterId,
        },
        action: {
          text: 'View Request',
          url: `/connections/requests/${requesterId}`,
        },
        priority: 'medium',
      });
    } catch (error) {
      logger.error('Error creating connection request notification:', error);
    }
  }

  async createProfileConnectionRequestNotification(requesterProfileId: mongoose.Types.ObjectId, receiverProfileId: mongoose.Types.ObjectId, connectionId: mongoose.Types.ObjectId) {
    try {
      // Get the profiles
      const ProfileModel = mongoose.model('Profile');
      const requesterProfile = await ProfileModel.findById(requesterProfileId).select('name profileImage owner');
      const receiverProfile = await ProfileModel.findById(receiverProfileId).select('name owner');

      if (!requesterProfile || !receiverProfile) return;

      return this.createNotification({
        recipient: receiverProfile.owner,
        type: 'profile_connection_request',
        title: 'New Profile Connection Request',
        message: `${requesterProfile.name} wants to connect with your profile ${receiverProfile.name}`,
        relatedTo: {
          model: 'ProfileConnection',
          id: connectionId,
        },
        action: {
          text: 'View Request',
          url: `/profiles/${receiverProfileId}/connections/requests`,
        },
        priority: 'medium',
        data: {
          requesterProfileId,
          receiverProfileId,
          connectionId,
          requesterProfileName: requesterProfile.name,
          requesterProfileImage: requesterProfile.profileImage
        }
      });
    } catch (error) {
      logger.error('Error creating profile connection request notification:', error);
    }
  }

  async createProfileConnectionAcceptedNotification(requesterProfileId: mongoose.Types.ObjectId, receiverProfileId: mongoose.Types.ObjectId, connectionId: mongoose.Types.ObjectId) {
    try {
      // Get the profiles
      const ProfileModel = mongoose.model('Profile');
      const requesterProfile = await ProfileModel.findById(requesterProfileId).select('name owner');
      const receiverProfile = await ProfileModel.findById(receiverProfileId).select('name profileImage owner');

      if (!requesterProfile || !receiverProfile) return;

      return this.createNotification({
        recipient: requesterProfile.owner,
        type: 'profile_connection_accepted',
        title: 'Profile Connection Accepted',
        message: `${receiverProfile.name} has accepted your connection request`,
        relatedTo: {
          model: 'ProfileConnection',
          id: connectionId,
        },
        action: {
          text: 'View Profile',
          url: `/profiles/${receiverProfileId}`,
        },
        priority: 'medium',
        data: {
          requesterProfileId,
          receiverProfileId,
          connectionId,
          receiverProfileName: receiverProfile.name,
          receiverProfileImage: receiverProfile.profileImage
        }
      });
    } catch (error) {
      logger.error('Error creating profile connection accepted notification:', error);
    }
  }

  async createEndorsementNotification(endorserId: mongoose.Types.ObjectId, recipientId: mongoose.Types.ObjectId, skill: string) {
    try {
      const endorser:any = await User.findById(endorserId).select('firstName lastName');
      if (!endorser) return;

      return this.createNotification({
        recipient: recipientId,
        type: 'endorsement_received',
        title: 'New Skill Endorsement',
        message: `${endorser.firstName} ${endorser.lastName} endorsed you for ${skill}`,
        relatedTo: {
          model: 'User',
          id: endorserId,
        },
        priority: 'medium',
      });
    } catch (error) {
      logger.error('Error creating endorsement notification:', error);
    }
  }

  /**
   * Get the count of unread notifications for a user
   * @param userId User ID
   * @returns Count of unread notifications
   */
  async getUnreadCount(userId: mongoose.Types.ObjectId): Promise<number> {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
        isArchived: false
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  /**
   * Create a notification for a badge earned
   * @param profileId Profile ID that earned the badge
   * @param badgeName Name of the badge
   * @param badgeDescription Description of the badge
   * @param badgeIcon Icon of the badge
   * @returns The created notification
   */
  async createBadgeEarnedNotification(
    profileId: mongoose.Types.ObjectId | string,
    badgeName: string,
    badgeDescription: string,
    badgeIcon: string
  ) {
    try {
      // Get the profile to find the owner
      const ProfileModel = mongoose.model('Profile');
      const profile = await ProfileModel.findById(profileId).select('profileInformation.creator');

      if (!profile || !profile.profileInformation?.creator) {
        logger.error(`Could not find profile or profile owner for badge notification: ${profileId}`);
        return null;
      }

      const ownerId = profile.profileInformation.creator;

      return this.createNotification({
        recipient: ownerId,
        type: 'badge_earned',
        title: 'New Badge Earned',
        message: `Congratulations! You've earned the ${badgeName} badge.`,
        relatedTo: {
          model: 'Profile',
          id: profileId,
        },
        action: {
          text: 'View Badges',
          url: `/dashboard/badges`,
        },
        priority: 'medium',
        data: {
          badgeName,
          badgeDescription,
          badgeIcon,
          profileId
        }
      });
    } catch (error) {
      logger.error('Error creating badge earned notification:', error);
      return null;
    }
  }

  /**
   * Create a notification for a badge suggestion approved
   * @param profileId Profile ID that suggested the badge
   * @param badgeName Name of the suggested badge
   * @returns The created notification
   */
  async createBadgeSuggestionApprovedNotification(
    profileId: mongoose.Types.ObjectId | string,
    badgeName: string
  ) {
    try {
      // Get the profile to find the owner
      const ProfileModel = mongoose.model('Profile');
      const profile = await ProfileModel.findById(profileId).select('profileInformation.creator');

      if (!profile || !profile.profileInformation?.creator) {
        logger.error(`Could not find profile or profile owner for badge suggestion notification: ${profileId}`);
        return null;
      }

      const ownerId = profile.profileInformation.creator;

      return this.createNotification({
        recipient: ownerId,
        type: 'badge_suggestion_approved',
        title: 'Badge Suggestion Approved',
        message: `Your suggestion for the "${badgeName}" badge has been approved and is under review for implementation.`,
        relatedTo: {
          model: 'Profile',
          id: profileId,
        },
        action: {
          text: 'View Suggestions',
          url: `/dashboard/badge-suggestions`,
        },
        priority: 'medium',
        data: {
          badgeName,
          profileId
        }
      });
    } catch (error) {
      logger.error('Error creating badge suggestion approved notification:', error);
      return null;
    }
  }

  /**
   * Create a notification for a badge suggestion rejected
   * @param profileId Profile ID that suggested the badge
   * @param badgeName Name of the suggested badge
   * @param feedback Feedback from admin on why the suggestion was rejected
   * @returns The created notification
   */
  async createBadgeSuggestionRejectedNotification(
    profileId: mongoose.Types.ObjectId | string,
    badgeName: string,
    feedback: string
  ) {
    try {
      // Get the profile to find the owner
      const ProfileModel = mongoose.model('Profile');
      const profile = await ProfileModel.findById(profileId).select('profileInformation.creator');

      if (!profile || !profile.profileInformation?.creator) {
        logger.error(`Could not find profile or profile owner for badge suggestion notification: ${profileId}`);
        return null;
      }

      const ownerId = profile.profileInformation.creator;

      return this.createNotification({
        recipient: ownerId,
        type: 'badge_suggestion_rejected',
        title: 'Badge Suggestion Not Approved',
        message: `Your suggestion for the "${badgeName}" badge was not approved. Admin feedback: ${feedback}`,
        relatedTo: {
          model: 'Profile',
          id: profileId,
        },
        action: {
          text: 'View Suggestions',
          url: `/dashboard/badge-suggestions`,
        },
        priority: 'medium',
        data: {
          badgeName,
          feedback,
          profileId
        }
      });
    } catch (error) {
      logger.error('Error creating badge suggestion rejected notification:', error);
      return null;
    }
  }

  /**
   * Create a notification for a badge suggestion implemented
   * @param profileId Profile ID that suggested the badge
   * @param badgeName Name of the implemented badge
   * @returns The created notification
   */
  async createBadgeSuggestionImplementedNotification(
    profileId: mongoose.Types.ObjectId | string,
    badgeName: string
  ) {
    try {
      // Get the profile to find the owner
      const ProfileModel = mongoose.model('Profile');
      const profile = await ProfileModel.findById(profileId).select('profileInformation.creator');

      if (!profile || !profile.profileInformation?.creator) {
        logger.error(`Could not find profile or profile owner for badge suggestion notification: ${profileId}`);
        return null;
      }

      const ownerId = profile.profileInformation.creator;

      return this.createNotification({
        recipient: ownerId,
        type: 'badge_suggestion_implemented',
        title: 'Badge Suggestion Implemented',
        message: `Great news! Your suggestion for the "${badgeName}" badge has been implemented and is now available in the system.`,
        relatedTo: {
          model: 'Profile',
          id: profileId,
        },
        action: {
          text: 'View Badges',
          url: `/dashboard/badges`,
        },
        priority: 'high',
        data: {
          badgeName,
          profileId
        }
      });
    } catch (error) {
      logger.error('Error creating badge suggestion implemented notification:', error);
      return null;
    }
  }

  /**
   * Create a notification for a milestone achieved
   * @param profileId Profile ID that achieved the milestone
   * @param milestoneLevel Level of the milestone achieved
   * @param currentPoints Current points of the profile
   * @returns The created notification
   */
  async createMilestoneAchievedNotification(
    profileId: mongoose.Types.ObjectId | string,
    milestoneLevel: string,
    currentPoints: number
  ) {
    try {
      // Get the profile to find the owner
      const ProfileModel = mongoose.model('Profile');
      const profile = await ProfileModel.findById(profileId).select('profileInformation.creator');

      if (!profile || !profile.profileInformation?.creator) {
        logger.error(`Could not find profile or profile owner for milestone notification: ${profileId}`);
        return null;
      }

      const ownerId = profile.profileInformation.creator;

      return this.createNotification({
        recipient: ownerId,
        type: 'milestone_achieved',
        title: 'New Milestone Achieved',
        message: `Congratulations! You've reached the ${milestoneLevel} level with ${currentPoints} MyPts.`,
        relatedTo: {
          model: 'Profile',
          id: profileId,
        },
        action: {
          text: 'View Milestones',
          url: `/dashboard/milestones`,
        },
        priority: 'high',
        data: {
          milestoneLevel,
          currentPoints,
          profileId
        }
      });
    } catch (error) {
      logger.error('Error creating milestone achieved notification:', error);
      return null;
    }
  }
}
