const replace = require('replace-in-file');

// Log the module to see what is being imported.
console.log('--- [DEBUG] replace-in-file module:', replace);

const siteKey = process.env.RECAPTCHA_SITE_KEY;

if (!siteKey) {
    console.error('Error: RECAPTCHA_SITE_KEY environment variable not set.');
    process.exit(1);
}
console.log('--- [DEBUG] RECAPTCHA_SITE_KEY is available.');

const options = {
    files: [
        './index.html',
        './menu.html',
    ],
    from: /%%RECAPTCHA_SITE_KEY%%/g,
    to: siteKey,
};

// Switch to the async version which is often the default export
async function runReplace() {
    try {
        console.log('--- [DEBUG] Running replacement with options:', options);
        const results = await replace(options);
        console.log('Replacement results:', results);
        console.log('Successfully injected reCAPTCHA site key.');
    } catch (error) {
        console.error('Error occurred during file replacement:', error);
        process.exit(1);
    }
}

runReplace();