#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Valid widget types
const VALID_WIDGETS = [
  'text', 'textarea', 'number', 'select', 'multiselect',
  'email', 'url', 'phone', 'date', 'datetime',
  'boolean', 'file', 'image', 'object', 'list:text'
];

// Valid profile categories
const VALID_CATEGORIES = [
  'individual', 'accessory', 'group', 'business', 'personal', 'professional', 'academic'
];

// Valid profile types
const VALID_PROFILE_TYPES = [
  'personal', 'academic', 'work', 'professional', 'proprietor',
  'freelancer', 'artist', 'influencer', 'athlete', 'provider',
  'merchant', 'vendor', 'dummy',
  'emergency', 'medical', 'pet', 'ecommerce', 'home', 'transportation',
  'driver', 'drivers', 'event', 'dependent', 'rider',
  'group', 'team', 'family', 'neighbourhood', 'company', 'business',
  'association', 'organization', 'institution', 'community'
];

function validateField(field, fieldIndex, categoryName) {
  const errors = [];

  // Required field properties
  if (!field.name) {
    errors.push(`Field ${fieldIndex} in category '${categoryName}': Missing 'name' property`);
  }
  if (!field.label) {
    errors.push(`Field ${fieldIndex} in category '${categoryName}': Missing 'label' property`);
  }
  if (!field.widget) {
    errors.push(`Field ${fieldIndex} in category '${categoryName}': Missing 'widget' property`);
  } else if (!VALID_WIDGETS.includes(field.widget)) {
    errors.push(`Field ${fieldIndex} in category '${categoryName}': Invalid widget '${field.widget}'`);
  }
  if (typeof field.order !== 'number') {
    errors.push(`Field ${fieldIndex} in category '${categoryName}': Missing or invalid 'order' property`);
  }
  if (typeof field.enabled !== 'boolean') {
    errors.push(`Field ${fieldIndex} in category '${categoryName}': Missing or invalid 'enabled' property`);
  }

  // Validate subFields if present
  if (field.subFields && Array.isArray(field.subFields)) {
    field.subFields.forEach((subField, subIndex) => {
      if (!subField.name) {
        errors.push(`SubField ${subIndex} in field '${field.name}': Missing 'name' property`);
      }
      if (!subField.label) {
        errors.push(`SubField ${subIndex} in field '${field.name}': Missing 'label' property`);
      }
      if (!subField.widget) {
        errors.push(`SubField ${subIndex} in field '${field.name}': Missing 'widget' property`);
      } else if (!VALID_WIDGETS.includes(subField.widget)) {
        errors.push(`SubField ${subIndex} in field '${field.name}': Invalid widget '${subField.widget}'`);
      }
    });
  }

  return errors;
}

function validateCategory(category, categoryIndex, templateName) {
  const errors = [];

  if (!category.name) {
    errors.push(`Category ${categoryIndex} in template '${templateName}': Missing 'name' property`);
  }
  if (!category.label) {
    errors.push(`Category ${categoryIndex} in template '${templateName}': Missing 'label' property`);
  }
  if (!Array.isArray(category.fields)) {
    errors.push(`Category ${categoryIndex} in template '${templateName}': Missing or invalid 'fields' array`);
  } else {
    category.fields.forEach((field, fieldIndex) => {
      errors.push(...validateField(field, fieldIndex, category.name));
    });
  }

  return errors;
}

function validateTemplate(template, templateIndex) {
  const errors = [];

  // Required template properties
  if (!template.profileCategory) {
    errors.push(`Template ${templateIndex}: Missing 'profileCategory' property`);
  } else if (!VALID_CATEGORIES.includes(template.profileCategory)) {
    errors.push(`Template ${templateIndex}: Invalid profileCategory '${template.profileCategory}'`);
  }

  if (!template.profileType) {
    errors.push(`Template ${templateIndex}: Missing 'profileType' property`);
  } else if (!VALID_PROFILE_TYPES.includes(template.profileType)) {
    errors.push(`Template ${templateIndex}: Invalid profileType '${template.profileType}'`);
  }

  if (!template.name) {
    errors.push(`Template ${templateIndex}: Missing 'name' property`);
  }
  if (!template.slug) {
    errors.push(`Template ${templateIndex}: Missing 'slug' property`);
  }

  if (!Array.isArray(template.categories)) {
    errors.push(`Template ${templateIndex}: Missing or invalid 'categories' array`);
  } else {
    template.categories.forEach((category, categoryIndex) => {
      errors.push(...validateCategory(category, categoryIndex, template.name));
    });
  }

  return errors;
}

function validateTemplatesFile(filePath) {
  console.log(`Validating templates file: ${filePath}`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  // Read and parse JSON
  let templates;
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    templates = JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Invalid JSON format: ${error.message}`);
    return false;
  }

  // Check if it's an array
  if (!Array.isArray(templates)) {
    console.error('❌ JSON file must contain an array of templates');
    return false;
  }

  console.log(`📋 Found ${templates.length} templates to validate`);

  let totalErrors = 0;
  const templateStats = {};

  // Validate each template
  templates.forEach((template, index) => {
    const errors = validateTemplate(template, index);
    
    if (errors.length > 0) {
      console.log(`\n❌ Template ${index + 1} (${template.name || 'Unknown'}) has ${errors.length} errors:`);
      errors.forEach(error => console.log(`   - ${error}`));
      totalErrors += errors.length;
    } else {
      console.log(`✅ Template ${index + 1} (${template.name}) is valid`);
    }

    // Collect stats
    const category = template.profileCategory || 'unknown';
    const type = template.profileType || 'unknown';
    
    if (!templateStats[category]) {
      templateStats[category] = {};
    }
    if (!templateStats[category][type]) {
      templateStats[category][type] = 0;
    }
    templateStats[category][type]++;
  });

  // Print summary
  console.log('\n📊 Template Statistics:');
  Object.entries(templateStats).forEach(([category, types]) => {
    console.log(`  ${category}:`);
    Object.entries(types).forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });
  });

  console.log(`\n📋 Validation Summary:`);
  console.log(`   Total templates: ${templates.length}`);
  console.log(`   Total errors: ${totalErrors}`);
  
  if (totalErrors === 0) {
    console.log('✅ All templates are valid!');
    return true;
  } else {
    console.log('❌ Validation failed with errors');
    return false;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || path.join(process.cwd(), 'new-template.json');

  const isValid = validateTemplatesFile(filePath);
  process.exit(isValid ? 0 : 1);
}

main();
