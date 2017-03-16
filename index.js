const config = require('./config')
const logger = require('./logger')
const BooksDemoApi = require('./lib/books-demo-api')

exports = module.exports = new BooksDemoApi(config, logger)
exports.BooksDemoApi = BooksDemoApi
