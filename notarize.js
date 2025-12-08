const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Use xcrun notarytool directly instead of @electron/notarize
 * to avoid network issues with the library
 */
async function notarizeWithXcrun(appPath, appleId, password, teamId) {
  // Create a zip file for notarization
  const appName = path.basename(appPath, '.app');
  const zipPath = path.join(path.dirname(appPath), `${appName}.zip`);
  
  console.log(`📦 Creating zip archive: ${zipPath}`);
  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, { stdio: 'inherit' });
  
  try {
    console.log('📤 Submitting to Apple notary service...');
    
    // Submit for notarization and wait for result
    const result = execSync(
      `xcrun notarytool submit "${zipPath}" --apple-id "${appleId}" --password "${password}" --team-id "${teamId}" --wait`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    console.log(result);
    
    // Staple the notarization ticket to the app
    console.log('📎 Stapling notarization ticket...');
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
    
    console.log('✅ Notarization and stapling complete!');
  } finally {
    // Clean up zip file
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
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

  console.log('🔐 Notarizing macOS build using xcrun notarytool...');

  await notarizeWithXcrun(
    appPath,
    process.env.APPLE_ID,
    process.env.APPLE_APP_SPECIFIC_PASSWORD,
    process.env.APPLE_TEAM_ID
  );

  console.log(`✅ Successfully notarized ${appName}`);
}; 