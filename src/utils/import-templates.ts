import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { ProfileTemplate, createTemplateFromJSON, validateTemplateData } from '../models/profiles/profile-template';

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

/**
 * Import profile templates from JSON file
 * @param jsonFilePath - Path to the JSON file containing templates
 * @param createdBy - ObjectId of the user creating the templates (optional)
 * @returns Promise<ImportResult>
 */
export const importTemplatesFromJSON = async (
  jsonFilePath: string, 
  createdBy?: mongoose.Types.ObjectId
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    imported: 0,
    failed: 0,
    errors: []
  };

  try {
    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
      result.errors.push(`File not found: ${jsonFilePath}`);
      return result;
    }

    // Read and parse JSON file
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    let templates: any[];

    try {
      templates = JSON.parse(fileContent);
    } catch (parseError) {
      result.errors.push(`Invalid JSON format: ${parseError}`);
      return result;
    }

    if (!Array.isArray(templates)) {
      result.errors.push('JSON file must contain an array of templates');
      return result;
    }

    console.log(`Found ${templates.length} templates to import...`);

    // Process each template
    for (let i = 0; i < templates.length; i++) {
      const templateData = templates[i];
      
      try {
        // Validate template data
        if (!validateTemplateData(templateData)) {
          result.failed++;
          result.errors.push(`Template ${i + 1}: Invalid template structure`);
          continue;
        }

        // Check if template already exists
        const existingTemplate = await ProfileTemplate.findOne({
          profileCategory: templateData.profileCategory,
          profileType: templateData.profileType
        });

        if (existingTemplate) {
          console.log(`Template ${templateData.name} already exists, updating...`);
          
          // Update existing template
          existingTemplate.name = templateData.name;
          existingTemplate.slug = templateData.slug;
          existingTemplate.categories = templateData.categories;
          existingTemplate.updatedBy = createdBy;
          
          await existingTemplate.save();
          result.imported++;
        } else {
          // Create new template
          await createTemplateFromJSON(templateData, createdBy);
          result.imported++;
          console.log(`Imported template: ${templateData.name}`);
        }

      } catch (error) {
        result.failed++;
        result.errors.push(`Template ${i + 1} (${templateData.name || 'Unknown'}): ${error}`);
        console.error(`Failed to import template ${i + 1}:`, error);
      }
    }

    result.success = result.failed === 0;
    console.log(`Import completed: ${result.imported} imported, ${result.failed} failed`);

    return result;

  } catch (error) {
    result.errors.push(`Import process failed: ${error}`);
    console.error('Import process failed:', error);
    return result;
  }
};

/**
 * Import templates from the default new-template.json file
 * @param createdBy - ObjectId of the user creating the templates (optional)
 * @returns Promise<ImportResult>
 */
export const importDefaultTemplates = async (createdBy?: mongoose.Types.ObjectId): Promise<ImportResult> => {
  const defaultPath = path.join(process.cwd(), 'new-template.json');
  return importTemplatesFromJSON(defaultPath, createdBy);
};

/**
 * Clear all existing templates (use with caution)
 * @returns Promise<number> - Number of deleted templates
 */
export const clearAllTemplates = async (): Promise<number> => {
  const result = await ProfileTemplate.deleteMany({});
  console.log(`Cleared ${result.deletedCount} templates`);
  return result.deletedCount || 0;
};

/**
 * Get template statistics
 * @returns Promise<object> - Statistics about templates
 */
export const getTemplateStats = async () => {
  const total = await ProfileTemplate.countDocuments();
  const byCategory = await ProfileTemplate.aggregate([
    { $group: { _id: '$profileCategory', count: { $sum: 1 } } }
  ]);
  const byType = await ProfileTemplate.aggregate([
    { $group: { _id: '$profileType', count: { $sum: 1 } } }
  ]);

  return {
    total,
    byCategory: byCategory.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byType: byType.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  };
};
