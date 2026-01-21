const fs = require('fs');
const path = require('path');

console.log('--- Running custom build script using Node.js fs ---');

const siteKey = process.env.RECAPTCHA_SITE_KEY;

if (!siteKey) {
    console.error('Error: RECAPTCHA_SITE_KEY environment variable not set. Build failed.');
    process.exit(1);
}

console.log('RECAPTCHA_SITE_KEY is available. Starting build...');

// Créer le dossier dist
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Fichiers à traiter (avec injection)
const filesToInject = [
    'index.html',
    'menu.html',
    'script.js',
];

// Traiter les fichiers avec injection
filesToInject.forEach(fileName => {
    const sourcePath = path.join(__dirname, '..', fileName);
    const destPath = path.join(distDir, fileName);
    
    try {
        console.log(`Processing file: ${fileName}`);
        
        if (!fs.existsSync(sourcePath)) {
            console.warn(`Warning: ${fileName} not found. Skipping.`);
            return;
        }
        
        let content = fs.readFileSync(sourcePath, 'utf8');
        
        if (content.includes('%%RECAPTCHA_SITE_KEY%%')) {
            content = content.replace(/%%RECAPTCHA_SITE_KEY%%/g, siteKey);
            console.log(`✓ Injected site key into ${fileName}`);
        }
        
        fs.writeFileSync(destPath, content, 'utf8');
    } catch (error) {
        console.error(`Error processing file ${fileName}:`, error);
        process.exit(1);
    }
});

// Copier tous les autres fichiers et dossiers nécessaires
const itemsToCopy = [
    'style.css',
    'sitemap.xml',
    'robots.txt',
    '_redirects',
    'favicon.png',
    'cgv.html',
    'legal.html',
    'suivi.html',
    'menu.html',
    'abonnements.html',
    'admin.html',
    'calculateur.html',
    'menu-personalise.html',
    'assets', 
    'locales', 
    'functions', 
    'api', 
];

itemsToCopy.forEach(item => {
    const sourcePath = path.join(__dirname, '..', item);
    const destPath = path.join(distDir, item);
    
    if (!fs.existsSync(sourcePath)) {
        console.warn(`Warning: ${item} not found. Skipping.`);
        return;
    }
    
    try {
        const stats = fs.statSync(sourcePath);
        
        if (stats.isDirectory()) {
            // Copier récursivement un dossier
            fs.cpSync(sourcePath, destPath, { recursive: true });
            console.log(`✓ Copied directory: ${item}`);
        } else {
            // Copier un fichier
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✓ Copied file: ${item}`);
        }
    } catch (error) {
        console.error(`Error copying ${item}:`, error);
        process.exit(1);
    }
});

console.log('Build script finished successfully. Output in ./dist');
process.exit(0);