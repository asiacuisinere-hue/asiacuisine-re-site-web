const fs = require('fs');
const path = require('path');

console.log('--- Running custom build script ---');

// Créer le dossier dist
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Liste de tous les fichiers à copier
const itemsToCopy = [
    'index.html',
    'menu.html',
    'script.js',
    'menu.js',
    'choix-menu.html',
    'choix-menu.js',
    'suivi.js',
    'admin.js',
    'personnalisation.js',
    'style.css',
    'sitemap.xml',
    'robots.txt',
    '_redirects',
    'favicon.png',
    'cgv.html',
    'legal.html',
    'suivi.html',
    'abonnements.html',
    'admin.html',
    'calculateur.html',
    'menu-personalise.html',
    'assets', 
    'locales', 
    'functions', 
    'api', 
    'boussole_nom.svg',
    'logo_luxilo.png',
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
            fs.cpSync(sourcePath, destPath, { recursive: true });
            console.log(`✓ Copied directory: ${item}`);
        } else {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✓ Copied file: ${item}`);
        }
    } catch (error) {
        console.error(`Error copying ${item}:`, error);
        process.exit(1);
    }
});

console.log('Build completed successfully. Output in ./dist');
process.exit(0);
