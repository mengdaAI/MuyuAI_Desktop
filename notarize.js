const { notarize } = require('@electron/notarize');
require('dotenv').config();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000; // 30 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function notarizeWithRetry(options, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔐 Notarization attempt ${attempt}/${retries}...`);
      await notarize(options);
      return; // Success
    } catch (error) {
      const isNetworkError = error.message && (
        error.message.includes('offline') ||
        error.message.includes('NSURLErrorDomain') ||
        error.message.includes('network')
      );
      
      if (isNetworkError && attempt < retries) {
        console.log(`⚠️  Network error on attempt ${attempt}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw error;
      }
    }
  }
}

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  console.log('🔐 Checking for notarization credentials...');

  const { appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('⚠️  Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID environment variables are not set.');
    console.log('⚠️  The app will not be notarized. Users will need to bypass Gatekeeper manually.');
    return;
  }

  console.log('🔐 Notarizing macOS build...');

  await notarizeWithRetry({
    appBundleId: 'com.muyulab.muyu',
    appPath: appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log(`✅ Successfully notarized ${appName}`);
}; 