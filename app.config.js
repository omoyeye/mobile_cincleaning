// Wraps app.json so builds still work before the Firebase file for Android push is added.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const android = { ...config.android };
  if (android.googleServicesFile && !fs.existsSync(path.join(__dirname, android.googleServicesFile))) {
    delete android.googleServicesFile;
  }
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || undefined;
  return {
    ...config,
    android,
    extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
  };
};
