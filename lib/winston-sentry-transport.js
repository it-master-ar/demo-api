const winston  = require('winston');
const raven    = require('raven');


class SentryTransport extends winston.Transport {

  constructor(opts) {
    super(opts);

    opts                  || (opts                  = {});
    opts.level            || (opts.level            = 'error');
    opts.handleExceptions || (opts.handleExceptions = true);
    opts.ravenClient      || (opts.ravenClient      = new raven.Client(opts.dsn));

    this.name             = 'sentry';
    this.level            = opts.level;
    this.handleExceptions = opts.handleExceptions;
    this.ravenClient      = opts.ravenClient;
  }

  log(level, msg, meta, cb) {
    if (meta instanceof Error) {
      return this.ravenClient.captureException(meta, cb);
    }
    this.ravenClient.captureMessage(msg, meta, cb);
  }

  logException(msg, meta, next, err) {
    this.ravenClient.captureException(err, meta);
    next(null);
  }
}


module.exports = SentryTransport;
