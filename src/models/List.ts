import mongoose, { Document, Schema, Model } from 'mongoose';
import { ITask } from './Tasks';
import { IProfile } from '../interfaces/profile.interface';
import { IUser } from './User';
import { Comment, repeatSettingsSchema, reminderSchema, RepeatSettings, Reminder } from './plans-shared';
import { commentSchema } from './plans-shared/comment.schema';

export interface IList extends Document {
  name: string;
  items: ListItem[];
  visibility: 'Public' | 'ConnectionsOnly' | 'OnlyMe' | 'Custom';
  reward?: Reward;
  color: string;
  type: ListType;
  importance: ImportanceLevel;
  notes?: string;
  createdBy: mongoose.Types.ObjectId | IUser;
  profile?: mongoose.Types.ObjectId | IProfile;
  participants: (mongoose.Types.ObjectId | IProfile)[];
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  relatedTask?: mongoose.Types.ObjectId | ITask;
  likes: Like[];
  comments: Comment[];
  favorite: boolean;
  shareHistory: ShareHistory[];
  shareableLink: string;
  linkAccess: 'view' | 'edit' | 'none';
  accessHistory: AccessHistory[];
}

export interface ListItem {
  _id: mongoose.Types.ObjectId;
  name: string;
  isCompleted: boolean;
  createdAt: Date;
  completedAt?: Date;
  assignedTo?: mongoose.Types.ObjectId | IProfile;
  repeat?: RepeatSettings;
  reminders?: Reminder[];
  duration?: number; // in minutes
  status?: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  subTasks?: ListItem[];
  attachments?: Attachment[];
  category?: string;
  notes?: string;
}

export interface Attachment {
  url: string;
  type: string; // e.g. 'image', 'pdf', etc.
  name?: string;
  uploadedAt?: Date;
}

export interface Like {
  profile: mongoose.Types.ObjectId | IProfile;
  createdAt: Date;
}

export enum ListType {
  Shopping = 'Shopping',
  Todo = 'Todo',
  Checklist = 'Checklist',
  Routine = 'Routine',
  Other = 'Other'
}

export enum ImportanceLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}


export interface Reward {
  type: 'Reward' | 'Punishment';
  points: number;
}

export interface ShareHistory {
  sharedBy: mongoose.Types.ObjectId | IProfile;
  sharedWith: mongoose.Types.ObjectId | IProfile;
  sharedAt: Date;
  action: 'shared' | 'unshared';
}

export interface AccessHistory {
  accessedBy: mongoose.Types.ObjectId | IProfile;
  accessedAt: Date;
  accessType: 'view' | 'edit';
  ipAddress?: string;
  userAgent?: string;
}

const attachmentSchema = new Schema<Attachment>({
  url: { type: String, required: true },
  type: { type: String, required: true },
  name: { type: String },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const listItemSchema = new Schema<ListItem>({
  _id: { type: Schema.Types.ObjectId, auto: true },
  name: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Profile' },
  repeat: repeatSettingsSchema,
  reminders: [reminderSchema],
  duration: { type: Number },
  status: { type: String, enum: ['upcoming', 'in_progress', 'completed', 'overdue'], default: 'upcoming' },
  subTasks: [/* recursive, see below */],
  attachments: [attachmentSchema],
  category: { type: String },
  notes: { type: String }
});
// For recursive subTasks, set after schema definition
listItemSchema.add({ subTasks: [listItemSchema] });

const likeSchema = new Schema<Like>({
  profile: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

const rewardSchema = new Schema<Reward>({
  type: {
    type: String,
    enum: ['Reward', 'Punishment'],
    required: true
  },
  points: { type: Number, required: true, min: 0 }
});

const shareHistorySchema = new Schema<ShareHistory>({
  sharedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true
  },
  sharedWith: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true
  },
  sharedAt: {
    type: Date,
    default: Date.now
  },
  action: {
    type: String,
    enum: ['shared', 'unshared'],
    required: true
  }
});

const accessHistorySchema = new Schema<AccessHistory>({
  accessedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true
  },
  accessedAt: {
    type: Date,
    default: Date.now
  },
  accessType: {
    type: String,
    enum: ['view', 'edit'],
    required: true
  },
  ipAddress: String,
  userAgent: String
});

const listSchema = new Schema<IList>(
  {
    name: { type: String, required: true },
    items: [listItemSchema],
    visibility: {
      type: String,
      enum: ['Public', 'ConnectionsOnly', 'OnlyMe', 'Custom'],
      default: 'Public'
    },
    reward: rewardSchema,
    color: { type: String, default: '#1DA1F2' },
    type: {
      type: String,
      enum: Object.values(ListType),
      default: ListType.Todo
    },
    importance: {
      type: String,
      enum: Object.values(ImportanceLevel),
      default: ImportanceLevel.Low
    },
    notes: { type: String },
    profile: {
      type: Schema.Types.ObjectId,
      ref: 'Profile'
    },
    participants: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
    category: { type: String },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    relatedTask: {
      type: Schema.Types.ObjectId,
      ref: 'Task'
    },
    likes: [likeSchema],
    comments: [commentSchema],
    favorite: { type: Boolean, default: false },
    shareHistory: [shareHistorySchema],
    shareableLink: { 
      type: String,
      unique: true,
      sparse: true,
      required: false
    },
    linkAccess: {
      type: String,
      enum: ['view', 'edit', 'none'],
      default: 'none'
    },
    accessHistory: [accessHistorySchema]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
      }
    }
  }
);

// Virtual for completion percentage
listSchema.virtual('completionPercentage').get(function () {
  if (this.items.length === 0) return 0;
  const completed = this.items.filter(item => item.isCompleted).length;
  return Math.round((completed / this.items.length) * 100);
});

// Indexes for better query performance
listSchema.index({ createdBy: 1 });
listSchema.index({ createdBy: 1, type: 1 });
listSchema.index({ createdBy: 1, importance: 1 });
listSchema.index({ relatedTask: 1 });

export interface ListModel extends Model<IList> {
  // You can add custom static methods here if needed
}

export const List = mongoose.model<IList, ListModel>('List', listSchema);
