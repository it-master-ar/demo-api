const http = require('http')
const url = require('url')
const express = require('express')
const expressBodyParser = require('body-parser')
const expressRest = require('express-rest-api')
const prettyMs = require('pretty-ms')
const onFinished = require('on-finished')
const config = require('../config')

const bookRouter = require('../route/book')

class Server {
  constructor (config, logger, database, tribune) {
    this.config = config
    this.logger = logger.child({ context: 'Server' })
    this.database = database
    this.tribune = tribune

    this.logger.verbose('Creating express app and HTTP server instance')
    this.expressApp = express()
    this._httpServer = http.createServer(this.expressApp)
    this.logger.verbose('Express app and HTTP server instance created')

    this._setupExpressMiddleware()
    this._setupExpressRoutes()
    this._setupErrorHandler()
  }

  listen (cb) {
    this.logger.verbose('Attempting to bind HTTP server to %s', this.config.server.url)
    const serverUrlParams = url.parse(this.config.server.url)
    this._httpServer.listen(serverUrlParams.port, serverUrlParams.hostname, (err) => {
      if (err) { return cb(err) }
      this.logger.verbose('HTTP server bound')
      cb(null)
    })
  }

  close (cb) {
    this._httpServer.close(cb)
  }

  _setupExpressMiddleware () {
    this.expressApp.request.config = this.config
    this.expressApp.request.service = (...args) => this.tribune.service(...args)
    this.expressApp.request.model = (...args) => this.database.model(...args)
    this.expressApp.request.pingDatabase = (...args) => this.database.ping(...args)

    const createReqLogger = (req, res, next) => {
      req._startTime = Date.now()
      req.logger = this.logger.child(
        req.headers['x-request-id'] ? { requestId: req.headers['x-request-id'] } : {}
      )

      req.logger.info('Incoming request', {
        httpVersion: req.httpVersion,
        method: req.method,
        url: req.url,
        headers: req.headers,
        trailers: req.trailers
      })

      onFinished(res, () => {
        req.logger.info('Outgoing response', {
          httpVersion: req.httpVersion,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: prettyMs(Date.now() - req._startTime)
        })
      })

      next(null)
    }

    this.logger.verbose('Attaching middleware to express app')
    this.expressApp.use(createReqLogger)
    this.expressApp.use(expressBodyParser.raw())
    this.expressApp.use(expressBodyParser.json())
    this.expressApp.use(expressRest({
      resourceId: '_id',
      maxResultsLimit: config.server.maxResultsLimit
    }))
    this.logger.verbose('Middleware attached')
  }

  _setupExpressRoutes () {
    this.logger.verbose('Attaching resource routers to express app')
    this.expressApp.use('/book', bookRouter)
    this.expressApp.use('/book', bookRouter)
    this.logger.verbose('Resource routers attached')
  }

  _setupErrorHandler () {
    this.logger.verbose('Attaching error handler')
    this.expressApp.use((err, req, res, next) => {
      err.statusCode || (err.statusCode = Server.statusCodeByErrorName[err.name] || 500)
      req.logger.error(err.toString(), err)
      req.logger.verbose('Responding to client', err.toString())
      res.status(err.statusCode).send(err.toString())
    })
    this.logger.verbose('Error handler attached')
  }
}

Server.statusCodeByErrorName = {
  ValidationError: 400,
  CastError: 400
}

module.exports = Server
