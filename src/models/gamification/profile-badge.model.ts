import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUserBadge, IUserBadgeActivityProgress } from '../../interfaces/gamification.interface';

export type ProfileBadgeDocument = IUserBadge & Document;

// Define the activity progress schema
const ActivityProgressSchema = new Schema<IUserBadgeActivityProgress>({
  activityId: {
    type: String,
    required: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  }
});


// clearly define the profile incentives
// mypts,stamps, rewards, badge, milestones


const ProfileBadgeSchema = new Schema<IUserBadge>(
  {
    badgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Badge',
      required: true
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    },
    activityProgress: [ActivityProgressSchema]
  },
  { timestamps: true }
);

// Create indexes for better query performance
ProfileBadgeSchema.index({ badgeId: 1 });
ProfileBadgeSchema.index({ isCompleted: 1 });
ProfileBadgeSchema.index({ completedAt: -1 });

export interface IProfileBadgeModel extends Model<IUserBadge> {
  findCompletedBadges(): Promise<ProfileBadgeDocument[]>;
  findInProgressBadges(): Promise<ProfileBadgeDocument[]>;
}

// Static methods
ProfileBadgeSchema.statics.findCompletedBadges = function(): Promise<ProfileBadgeDocument[]> {
  return this.find({ isCompleted: true }).sort({ completedAt: -1 });
};

ProfileBadgeSchema.statics.findInProgressBadges = function(): Promise<ProfileBadgeDocument[]> {
  return this.find({ isCompleted: false }).sort({ progress: -1 });
};

export const ProfileBadgeModel = mongoose.model<IUserBadge, IProfileBadgeModel>('ProfileBadge', ProfileBadgeSchema);
