const milieu = require('milieu')

const config = milieu('demoapi', {
  server: {
    url: 'http://localhost:9999',
    maxResultsLimit: 1000
  },

  mongo: {
    url: 'mongodb://localhost/demo-api'
  },

  logger: {
    console: {
      level: 'silly',
      timestamp: true,
      handleExceptions: true,
      humanReadableUnhandledException: true,
      colorize: true
    }
  }
})

module.exports = config
