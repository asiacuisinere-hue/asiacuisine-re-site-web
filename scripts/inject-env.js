const replace = require('replace-in-file');

const siteKey = process.env.RECAPTCHA_SITE_KEY;

if (!siteKey) {
    console.error('Error: RECAPTCHA_SITE_KEY environment variable not set.');
    process.exit(1);
}

const options = {
    files: [
        './index.html',
        './menu.html',
    ],
    from: /%%RECAPTCHA_SITE_KEY%%/g,
    to: siteKey,
};

try {
    const results = replace.sync(options);
    console.log('Replacement results:', results);
    console.log('Successfully injected reCAPTCHA site key.');
} catch (error) {
    console.error('Error occurred during file replacement:', error);
    process.exit(1);
}
