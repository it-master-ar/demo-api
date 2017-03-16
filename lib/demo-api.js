const async       = require('async');
const Database    = require('./database');
const Tribune     = require('tribune');
const Server      = require('./server');
const vaultConfig = require('./vault-config');

class DemoApi {

  constructor(config, logger) {
    this.config    = config;
    this.logger    = logger.child({ context: 'DemoApi' });
    this.isRunning = false;
    this.database  = new Database(config, this.logger);
    this.tribune   = new Tribune({ agentUrl: this.config.consul.url });
    this.server    = new Server(config, this.logger, this.database, this.tribune);
  }

  start(cb) {
    if (this.isRunning) {
      throw new Error('Cannot start DemoApi because it is already running');
    }
    this.isRunning = true;

    this.logger.verbose('Starting DemoApi');

    this.logger.verbose('Compiling Vault secrets into config');
    const vaultUrl   = this.config.vault.url;
    const vaultToken = this.config.vault.token;
    vaultConfig(vaultUrl, vaultToken, this.config, (err) => {
      if (err) { return cb(err); }
      this.logger.verbose('Config compiled.');

      async.parallel([
        (cb) => this.database.connect(cb),
        (cb) => this.server.listen(cb)
      ], (err) => {
        if (err) { return cb(err); }

        this.logger.verbose('Registering DemoApi as a service with Consul');
        this.tribune.register('DemoApi', {
          url       : this.config.server.url,
          interval  : this.config.consul.interval,
          statusPath: this.config.consul.statusPath
        }, (err) => {

          this.logger.verbose('DemoApi ready and awaiting requests');
          cb(null, { url: this.config.server.url });
        });
      });
    });
  }

  stop(cb) {
    if (!this.isRunning) {
      throw new Error('Cannot stop DemoApi because it is already stopping');
    }
    this.isRunning = false;

    this.logger.verbose('Stopping DemoApi');
    async.parallel([
      (cb) => { this.database.disconnect(cb); },
      (cb) => { this.server.close(cb); }
    ], (err) => {
      if (err) { return cb(err); }

      this.logger.verbose('Deregistering DemoApi from Consul');
      this.tribune.deregister((err) => {
        if (err) { return cb(err); }

        this.logger.verbose('DemoApi has closed all connections and successfully halted');
        cb(null);
      });
    });
  }
}


module.exports = DemoApi;
