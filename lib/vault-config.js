const request = require('request');


const compileConfig = (secureData, config) => {
  for (const prop in config) {
    if (!config[prop]) { continue; }

    if (typeof config[prop] === 'object') {
      compileConfig(secureData, config[prop]);
      continue;
    }

    if (typeof config[prop] === 'string') {
      const typeTokenMatch = config[prop].match(/^#[\w\d]+\|[nbs]$/);
      if (typeTokenMatch) {
        const token = typeTokenMatch[0];
        const type  = token[token.length - 1];
        const key   = token.slice(1, token.length - 2);
        let   val   = (secureData && secureData[key] !== undefined) ?
                      secureData[key] : '';

        if (val) {
          switch (type) {
            case 'b': val = !!val;           break;
            case 'n': val = parseFloat(val); break;
            case 's':                        break;
            default : val = '';              break;
          }
        }

        config[prop] = val;
        continue;
      }

      const strTokens = config[prop].match(/#\{[\w\d]+\}/g);
      if (!strTokens) { continue; }

      for (let i = 0; i < strTokens.length; i += 1) {
        const token = strTokens[i];
        const key   = token.slice(2, token.length - 1);
        const val   = (secureData && secureData[key] !== undefined) ?
                      secureData[key] : '';
        config[prop] = config[prop].replace(token, val);
      }
    }
  }
};

const compileVaultConfig = (url, token, config, cb) => {
  if (!url) {
    compileConfig(null, config);
    return cb(null);
  }

  let   reAttemptIn      = 100;
  let   numberOfattempts = 0;
  const makeRequest = () => {

    request.get(url, {
      json   : true,
      headers: { 'x-vault-token': token }
    }, (err, res) => {
      if (err) { return cb(err); }

      numberOfattempts += 1;

      if (res.statusCode >= 500) {
        if (numberOfattempts > 5) {
          cb(new Error(
            'Failed to connect to Vault. Attempted to contact Vault 5 times, ' +
            'but it responded with a 500 range status code every time.'
          ));
        }
        return setTimeout(makeRequest, 500);
      }

      if (res.statusCode === 429) {
        if (reAttemptIn > 10000) {
          return cb(new Error(
            'Failed to connect to Vault. Vault responded with a 429 even ' +
            'after waiting up to 10 seconds between requests.'
          ));
        }

        setTimeout(makeRequest, reAttemptIn);
        reAttemptIn *= 2;
        return;
      }

      if (res.statusCode === 404) {
        return cb(new Error(
          'Failed to connect to Vault. Vault responded with a 404.'
        ));
      }

      if (res.statusCode === 403) {
        return cb(new Error(
          'Failed to connect to Vault. Vault rejected the authentication ' +
          'token provided and responded with a 403.'
        ));
      }

      if (res.statusCode === 400) {
        return cb(new Error(
          'Failed to connect to Vault. Vault rejected the request body with ' +
          'a 400.'
        ));
      }

      if (res.statusCode === 204) {
        return cb(new Error(
          'Successfully connected to Vault, but it responded with a 204 ' +
          'and no data.'
        ));
      }

      if (res.statusCode !== 200) {
        return cb(new Error(
          `Expected a statusCode of 200 from Vault but got ${res.statusCode}` +
          ' instead.'
        ));
      }

      compileConfig(res.body.data, config);

      cb(null);
    });
  };

  makeRequest();
};


module.exports = compileVaultConfig;
