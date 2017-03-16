const extend = require('extend');
const common = require('winston/lib/winston/common');


class ChildLogger {

  constructor(logger, prefix, meta) {
    if (typeof prefix === 'object') {
      meta   = prefix;
      prefix = '';
    }

    prefix || (prefix = '');
    meta   || (meta = null);

    if (meta) {
      meta = extend(true, {}, meta);
    }

    this.logger = logger;
    this.levels = logger.levels;
    this.prefix = prefix;
    this.meta   = meta;

    common.setLevels(this, [], this.levels);
  }

  log(level, ...args) {
    if (this.prefix && typeof args[0] === 'string') {
      args[0] = this.prefix + args[0];
    }

    if (this.meta) {
      let metaIndex = args.length - 1;
      while (args[metaIndex] === null) {
        metaIndex -= 1;
      }
      if (typeof args[metaIndex] === 'function') {
        metaIndex -= 1;
      }

      const meta = {};
      if (typeof args[metaIndex] === 'object') {
        extend(true, meta, args[metaIndex]);
      } else {
        args.splice(metaIndex + 1, 0, meta);
      }

      for (const key in this.meta) {
        meta[key] = this.meta[key];
      }
    }

    this.logger.log.apply(this.logger, [level].concat(args));
  }

  child(prefix, meta) {
    return new ChildLogger(this, prefix, meta);
  }
}

function extendLogger(logger) {
  logger.child = ChildLogger.prototype.child;
  return logger;
}


exports = module.exports = extendLogger;
exports.ChildLogger = ChildLogger;
