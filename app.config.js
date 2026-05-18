const appJson = require('./app.json');

module.exports = () => {
  const expo = { ...appJson.expo };

  if (process.env.GOOGLE_SERVICES_JSON) {
    expo.android = {
      ...expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    };
  }

  return { expo };
};
