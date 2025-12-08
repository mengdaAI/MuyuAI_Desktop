const { notarize } = require('@electron/notarize');
require('dotenv').config();

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

  await notarize({
    appBundleId: 'com.muyulab.muyu',
    appPath: appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log(`✅ Successfully notarized ${appName}`);
}; 