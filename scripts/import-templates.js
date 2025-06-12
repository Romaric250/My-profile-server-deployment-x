#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
const { importDefaultTemplates, clearAllTemplates, getTemplateStats } = require('../src/utils/import-templates');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await connectToDatabase();

  try {
    switch (command) {
      case 'import':
        console.log('Starting template import...');
        const result = await importDefaultTemplates();
        
        console.log('\n=== Import Results ===');
        console.log(`Success: ${result.success}`);
        console.log(`Imported: ${result.imported}`);
        console.log(`Failed: ${result.failed}`);
        
        if (result.errors.length > 0) {
          console.log('\nErrors:');
          result.errors.forEach(error => console.log(`- ${error}`));
        }
        break;

      case 'clear':
        console.log('Clearing all templates...');
        const cleared = await clearAllTemplates();
        console.log(`Cleared ${cleared} templates`);
        break;

      case 'stats':
        console.log('Getting template statistics...');
        const stats = await getTemplateStats();
        console.log('\n=== Template Statistics ===');
        console.log(`Total templates: ${stats.total}`);
        console.log('\nBy Category:');
        Object.entries(stats.byCategory).forEach(([category, count]) => {
          console.log(`  ${category}: ${count}`);
        });
        console.log('\nBy Type:');
        Object.entries(stats.byType).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
        break;

      case 'reset':
        console.log('Resetting all templates...');
        const clearedCount = await clearAllTemplates();
        console.log(`Cleared ${clearedCount} templates`);
        
        console.log('Importing fresh templates...');
        const importResult = await importDefaultTemplates();
        console.log(`Imported: ${importResult.imported}, Failed: ${importResult.failed}`);
        break;

      default:
        console.log('Usage: node scripts/import-templates.js <command>');
        console.log('Commands:');
        console.log('  import  - Import templates from new-template.json');
        console.log('  clear   - Clear all existing templates');
        console.log('  stats   - Show template statistics');
        console.log('  reset   - Clear all templates and import fresh ones');
        break;
    }
  } catch (error) {
    console.error('Script execution failed:', error);
  } finally {
    await disconnectFromDatabase();
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main();
