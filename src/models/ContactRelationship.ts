import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUser } from './User';       
import { Contact } from './Contact';  


export interface IContactRelationship extends Document {

  relationshipTypeId: mongoose.Types.ObjectId ;
  fromContact: mongoose.Types.ObjectId | typeof Contact;

  

  toContact: mongoose.Types.ObjectId | typeof Contact;

  createdBy: mongoose.Types.ObjectId | IUser;

  fromContactAccepted: boolean;
  toContactAccepted: boolean;

  fromName: string;
  toName: string;
  
  


  acceptedAt?: Date;

}


const contactRelationshipSchema = new Schema<IContactRelationship>(
  {

    relationshipTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'RelationshipType',
      required: true,
      index: true
    },

    fromContact: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true
    },

    toContact: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fromContactAccepted: {
      type: Boolean,
      default: true,
      index: true
    },
    toContactAccepted: {
      type: Boolean,
      default: false,
      index: true
    },

  
    acceptedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
      }
    }
  }
);

//  a unique index so that a given "fromContact → toContact" pair can only exist once
contactRelationshipSchema.index(
  { fromContact: 1, toContact: 1, },
  { unique: true }
);


contactRelationshipSchema.pre<IContactRelationship>('save', function (next) {
  if (this.isModified('toContactAccepted') && this.toContactAccepted && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
  next();
});

export interface ContactRelationshipModel extends Model<IContactRelationship> {}

export const ContactRelationship = mongoose.model<IContactRelationship, ContactRelationshipModel>(
    'ContactRelationship',
    contactRelationshipSchema
);