const config = require('./config')
const logger = require('./logger')
const DemoApi = require('./lib/books-demo-api')

exports = module.exports = new DemoApi(config, logger)
exports.DemoApi = DemoApi
