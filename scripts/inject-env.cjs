const fs = require('fs');
const path = require('path');

console.log('--- Running custom build script using Node.js fs ---');

const siteKey = process.env.RECAPTCHA_SITE_KEY;

if (!siteKey) {
    console.error('Error: RECAPTCHA_SITE_KEY environment variable not set. Build failed.');
    process.exit(1);
}

console.log('RECAPTCHA_SITE_KEY is available. Starting file replacements...');

const filesToProcess = [
    path.join(__dirname, '..', 'index.html'),
    path.join(__dirname, '..', 'menu.html'),
];

filesToProcess.forEach(filePath => {
    try {
        console.log(`Processing file: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (!content.includes('%%RECAPTCHA_SITE_KEY%%')) {
            console.warn(`Warning: Placeholder not found in ${filePath}. Skipping.`);
            return;
        }

        const newContent = content.replace(/%%RECAPTCHA_SITE_KEY%%/g, siteKey);
        fs.writeFileSync(filePath, newContent, 'utf8');
        
        console.log(`Successfully injected site key into ${filePath}`);
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        process.exit(1);
    }
});

console.log('Build script finished successfully.');
process.exit(0);
