const milieu = require('milieu')

const config = milieu('demoapi', {
  server: {
    url: 'http://localhost:8000',
    maxResultsLimit: 1000
  },
  mongo: {
    url: 'mongodb://localhost/demo-api'
  },
  vault: {
    url: '',
    token: ''
  },
  consul: {
    url: 'http://localhost:8500',
    statusPath: '/status',
    interval: 6000
  },
  logger: {
    sentry: {
      dsn: ''
    },
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
