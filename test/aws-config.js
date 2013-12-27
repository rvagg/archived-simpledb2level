var config

try {
  config = require('./aws-config.json')
} catch (e) {
  try {
    config = JSON.parse(process.env.AWS_CONFIG)
  } catch (e) {
    try {
      var _config = {
          accessKeyId     : process.env.AWS_ACCESS_KEY_ID
        , secretAccessKey : process.env.AWS_SECRET_ACCESS_KEY
        , region          : process.env.AWS_REGION
      }
      if (typeof _config.accessKeyId == 'string'
          && typeof _config.secretAccessKey == 'string'
          && typeof _config.region == 'string') {
        config = _config
      }
    } catch (e) {}
  }
}

if (typeof config != 'object')
  throw new Error('No aws-config.json or $AWS_CONFIG to work with')

module.exports = config