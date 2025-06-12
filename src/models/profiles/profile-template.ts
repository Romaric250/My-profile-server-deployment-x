import mongoose, { Document, Model, Schema } from 'mongoose';

export type ProfileCategory = 'individual' | 'accessory' | 'group' | 'business' | 'personal' | 'professional' | 'academic';

export const PROFILE_TYPE_ENUM = [
  // individual profiletype
  'personal', 'academic', 'work', 'professional', 'proprietor',
  'freelancer', 'artist', 'influencer', 'athlete', 'provider',
  'merchant', 'vendor', "dummy",
  // accessory profiletype
  'emergency', 'medical', 'pet', 'ecommerce', 'home', 'transportation',
  'driver', 'drivers', 'event', 'dependent', 'rider',
  // group profiletype
  'group', 'team', 'family', 'neighbourhood', 'company', 'business',
  'association', 'organization', 'institution', 'community'
] as const;

export type ProfileType = typeof PROFILE_TYPE_ENUM[number];

export type FieldWidget =
  | 'text' | 'textarea' | 'number' | 'select' | 'multiselect'
  | 'email' | 'url' | 'phone' | 'date' | 'datetime'
  | 'boolean' | 'file' | 'image' | 'object' | 'list:text';

export interface IFieldOption {
  label: string;
  value: string | number;
}

export interface IFieldValidation {
  min?: number;
  max?: number;
  regex?: string;
}

export interface ISubField {
  name: string;
  label: string;
  widget: FieldWidget;
  description?: string;
  options?: IFieldOption[];
  validation?: IFieldValidation;
}

export interface ITemplateField {
  name: string;
  label: string;
  widget: FieldWidget;
  content?: any;
  order: number;
  enabled: boolean;
  value?: any;
  required?: boolean;
  default?: any;
  placeholder?: string;
  description?: string;
  options?: IFieldOption[];
  validation?: IFieldValidation;
  subFields?: ISubField[];
}

export interface ITemplateCategory {
  name: string;           
  label: string;          
  icon?: string;          
  collapsible?: boolean;  
  fields: ITemplateField[]; 
}

export interface IProfileTemplate extends Document {
  profileCategory: ProfileCategory;
  profileType: ProfileType;

  name: string;            // Human-readable name
  slug: string;            // URL-friendly identifier for the web version

  categories: ITemplateCategory[];

  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const SubFieldSchema = new Schema<ISubField>(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    widget: { type: String, required: true },
    description: { type: String },
    options: [{
      label: { type: String, required: true },
      value: Schema.Types.Mixed
    }],
    validation: {
      min: Number,
      max: Number,
      regex: String
    }
  },
  { _id: false }
);

const FieldSchema = new Schema<ITemplateField>(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    widget: { type: String, required: true },
    content: { type: Schema.Types.Mixed },
    order: { type: Number, required: true },
    enabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    default: { type: Schema.Types.Mixed },
    placeholder: { type: String },
    description: { type: String },
    options: [{
      label: { type: String, required: true },
      value: Schema.Types.Mixed
    }],
    validation: {
      min: Number,
      max: Number,
      regex: String
    },
    subFields: { type: [SubFieldSchema], default: [] }
  },
  { _id: false }
);

const CategorySchema = new Schema<ITemplateCategory>(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    icon: String,
    collapsible: { type: Boolean, default: true },
    fields: { type: [FieldSchema], default: [] }
  },
  { _id: false }
);

const TemplateSchema = new Schema<IProfileTemplate>(
  {
    profileCategory: {
      type: String,
      enum: ['individual', 'accessory', 'group', 'business', 'personal', 'professional', 'academic'],
      required: true,
      index: true
    },
    profileType: {
      type: String,
      enum: PROFILE_TYPE_ENUM,
      required: true,
      index: true
    },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    categories: { type: [CategorySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'SuperAdmin', required: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'SuperAdmin' }
  },
  { timestamps: true }
);

TemplateSchema.index(
  { profileCategory: 1, profileType: 1 },
  { unique: true }
);

export const ProfileTemplate: Model<IProfileTemplate> =
  mongoose.model<IProfileTemplate>('ProfileTemplate', TemplateSchema);

// Helper function to validate template data before saving
export const validateTemplateData = (templateData: any): boolean => {
  try {
    // Check required fields
    if (!templateData.profileCategory || !templateData.profileType || !templateData.name || !templateData.slug) {
      return false;
    }

    // Validate profile category
    const validCategories = ['individual', 'accessory', 'group', 'business', 'personal', 'professional', 'academic'];
    if (!validCategories.includes(templateData.profileCategory)) {
      return false;
    }

    // Validate profile type
    if (!PROFILE_TYPE_ENUM.includes(templateData.profileType)) {
      return false;
    }

    // Validate categories structure
    if (templateData.categories && Array.isArray(templateData.categories)) {
      for (const category of templateData.categories) {
        if (!category.name || !category.label || !Array.isArray(category.fields)) {
          return false;
        }

        // Validate fields structure
        for (const field of category.fields) {
          if (!field.name || !field.label || !field.widget || typeof field.order !== 'number') {
            return false;
          }
        }
      }
    }

    return true;
  } catch (error) {
    return false;
  }
};

// Helper function to create template from JSON data
export const createTemplateFromJSON = async (templateData: any, createdBy?: mongoose.Types.ObjectId): Promise<IProfileTemplate> => {
  if (!validateTemplateData(templateData)) {
    throw new Error('Invalid template data structure');
  }

  const template = new ProfileTemplate({
    ...templateData,
    createdBy: createdBy || new mongoose.Types.ObjectId()
  });

  return await template.save();
};