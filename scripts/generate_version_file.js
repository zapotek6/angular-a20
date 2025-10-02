const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const path = require('path');

// Get the current Git tag
let gitTag;
try {
  gitTag = execSync('git describe --tags', { encoding: 'utf-8' }).trim();
} catch (error) {
  console.error('Failed to retrieve Git tag:', error);
  gitTag = 'unknown'; // fallback value
}

// Create a new environment.ts file with the version
const versionFilePath = path.join(__dirname, '../src/environments/version.ts');
const versionFileContent = `export const version = '${gitTag}';\n`;

console.log('Writing version to:', versionFilePath);
writeFileSync(versionFilePath, versionFileContent, { encoding: 'utf-8' });
console.log('Version file created:', gitTag);