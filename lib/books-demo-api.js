const async = require('async')
const Database = require('./database')
const Server = require('./server')

class BooksDemoApi {
  constructor (config, logger) {
    this.config = config
    this.logger = logger.child({ context: 'BooksDemoApi' })
    this.isRunning = false
    this.database = new Database(config, this.logger)
    this.server = new Server(config, this.logger, this.database, this.tribune)
  }

  start (cb) {
    if (this.isRunning) {
      throw new Error('Cannot start BooksDemoApi because it is already running')
    }
    this.isRunning = true

    this.logger.verbose('Starting BooksDemoApi')

    this.logger.verbose('Compiling Vault secrets into config')
    async.parallel([
      (cb) => this.database.connect(cb),
      (cb) => this.server.listen(cb)
    ], (err) => {
      if (err) { return cb(err) }

      this.logger.verbose('BooksDemoApi ready and awaiting requests')
      cb(null, { url: this.config.server.url })
    })
  }

  stop (cb) {
    if (!this.isRunning) {
      throw new Error('Cannot stop BooksDemoApi because it is already stopping')
    }
    this.isRunning = false

    this.logger.verbose('Stopping BooksDemoApi')
    async.parallel([
      (cb) => { this.database.disconnect(cb) },
      (cb) => { this.server.close(cb) }
    ], (err) => {
      if (err) { return cb(err) }

      this.logger.verbose('Deregistering BooksDemoApi from Consul')
      this.tribune.deregister((err) => {
        if (err) { return cb(err) }

        this.logger.verbose('BooksDemoApi has closed all connections and successfully halted')
        cb(null)
      })
    })
  }
}

module.exports = BooksDemoApi
