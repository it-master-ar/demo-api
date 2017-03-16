const Model = require('mongoose').Model;


const mongooseSlugs = (schema, opts) => {
  opts               || (opts               = {});
  opts.sourceField   || (opts.sourceField   = 'name');
  opts.maxLength     || (opts.maxLength     = 30);
  opts.maxAliases    || (opts.maxAliases    = 30);
  opts.slugGenerator || (opts.slugGenerator = (val) => val
    .replace(/([\w\d])'([\w\d])/g, '$1$2')
    .replace(/([\w\d])[^\w\d]+([\w\d])/g, '$1-$2')
    .replace(/[^\w\d-]+/g, '')
    .toLowerCase());

  const setSlug = function(newSlug) {
    if (!this.slug || this.slug === newSlug) { return newSlug; }

    if (this.aliasSlugs.indexOf(this.slug) === -1) {
      this.aliasSlugs.push(this.slug);
    }
    if (this.aliasSlugs > opts.maxAliases) {
      this.aliasSlugs.length = opts.maxAliases;
    }

    const i = this.aliasSlugs.indexOf(newSlug);
    if (i > -1) { this.aliasSlugs.splice(i, 1); }

    return newSlug;
  };

  schema.add({
    slug      : { type: String, unique: true, maxLength: opts.maxLength, set: setSlug },
    aliasSlugs: [{ type: String, default: () => [], select: false }]
  });

  const transformQueryConditions = (conditions, transform) => {
    const logicalOperators = ['$or', '$and', '$nor'];

    for (let i = 0; i < logicalOperators.length; i += 1) {
      const logicalOperator = logicalOperators[i];
      if (conditions[logicalOperator] === undefined) { continue; }
      for (let j = 0; j < conditions[logicalOperator].length; j += 1) {
        transformQueryConditions(conditions[logicalOperator][j], transform);
      }
    }

    transform(conditions);
  };

  const addAliasSlugsQuery = function() {
    const conditions = this.getQuery();

    let aliasSlugs;
    if (conditions.$aliasSlugs !== undefined) {
      aliasSlugs = conditions.$aliasSlugs;
      delete conditions.$aliasSlugs;
    }

    if (aliasSlugs === false) { return; }

    transformQueryConditions(this.getQuery(), (conditions) => {
      if (conditions.slug !== undefined) {
        const slugBiasedConditions      = Object.assign({}, conditions);
        const slugAliasBiasedConditions = Object.assign({}, conditions);

        slugAliasBiasedConditions.aliasSlugs = slugAliasBiasedConditions.slug;
        delete slugAliasBiasedConditions.slug;

        for (const prop in conditions) { delete conditions[prop]; }

        conditions.$or = [
          slugBiasedConditions,
          slugAliasBiasedConditions
        ];
      }
    });
  };

  schema.pre('count',            addAliasSlugsQuery);
  schema.pre('find',             addAliasSlugsQuery);
  schema.pre('findOne',          addAliasSlugsQuery);
  schema.pre('findOneAndRemove', addAliasSlugsQuery);
  schema.pre('findOneAndUpdate', addAliasSlugsQuery);
  schema.pre('update',           addAliasSlugsQuery);

  schema.pre('save', function(next) {
    if (this.slug === undefined) {
      const val = this.get(opts.sourceField);
      if (val === undefined || val.length < 1) {
        this.slug = this.constructor.modelName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      } else {
        this.slug = opts.slugGenerator(val).slice(0, opts.maxLength);
      }
    }

    if (!this.isModified('slug')) { return next(null); }

    this._suffixSlug(this.slug, (err, slug) => {
      if (err) { return next(err); }

      this._pruneAliasSlug(slug, (err) => {
        if (err) { return next(err); }

        this.slug = slug;
        next(null);
      });
    });
  });

  schema.static('findBySlug', function(slug, cb) {
    return this.findOne({
      $or: [{ slug }, { aliasSlugs: slug }]
    }, cb);
  });

  const originalStaticUpdate = schema.statics.update || Model.update;
  schema.static('update', function(query, delta, opts, cb) {
    const newSlug = delta.slug || delta.$set && delta.$set.slug;

    if (newSlug === undefined && (!delta.$unset || !delta.$unset.slug)) {
      return originalStaticUpdate.call(this, query, delta, opts, cb);
    }

    // NOTE: Taken from Model.prototype.update. Modified accordingly.
    // See => https://github.com/Automattic/mongoose/blob/4.4.3/lib/query.js#L1998
    if (typeof opts === 'function') {
      cb   = opts;
      opts = undefined;
    } else if (typeof doc === 'function') {
      cb    = delta;
      delta = query;
      query = undefined;
      opts  = undefined;
    } else if (typeof query === 'function') {
      cb    = query;
      query = undefined;
      delta = undefined;
      opts  = undefined;
    } else if (typeof query === 'object' && !delta && !opts && !cb) {
      delta = query;
      query = undefined;
      opts  = undefined;
      cb    = undefined;
    }

    query || (query = {});
    delta || (delta = {});
    opts  || (opts  = {});
    cb    || (cb    = function() {});

    const updateDocumentSlug = (document, cb) => {
      document.slug = newSlug;
      document.save({ safe: opts.safe }, (err, _, nModified) => {
        if (err) { return cb(err); }
        return cb(null, { n: 1, nModified });
      });
    };

    if (opts.multi === true) {
      return this.find(query, (err, documents) => {
        if (err) { return cb(err); }

        let   ii      = 0;
        const results = { n: 0, nModified: 0 };
        const onDocumentUpdated = (err, updateResults) => {
          if (err) { return cb(err); }

          results.n         += updateResults.n;
          results.nModified += updateResults.nModified;

          ii += 1;
          if (ii === documents.length) {
            cb(null, results);
          }
        };

        for (let i = 0; i < documents.length; i += 1) {
          updateDocumentSlug(documents[i], onDocumentUpdated);
        }
      });
    }

    const upsertDocument = (delta) => {
      if (delta.$set) { delta = delta.$set; }
      (new this(delta)).save((err, document) => {
        if (err) { return cb(err); }
        return cb(null, {
          n : 0,
          nUpserted: 1,
          nModified: 0,
          _id      : document._id
        });
      });
    };

    return this.findOne(query, (err, document) => {
      if (err) { return cb(err); }

      if (!document) {
        if (opts.upsert) { return upsertDocument(delta); }
        return cb(null, { n: 0, nModified: 0 });
      }

      updateDocumentSlug(document, cb);
    });
  });

  schema.method('_suffixSlug', function(slug, cb) {
    this.constructor.findOne({
      _id        : { $ne: this._id },
      slug       : { $regex: `^${slug}` },
      $aliasSlugs: false
    }).sort('-slug').select('slug').exec((err, document) => {
      if (err) { return cb(err); }

      if (!document) { return cb(null, slug); }

      const lastSlugSuffix = document.slug.slice(slug.length + 1);
      const slugSuffix     = lastSlugSuffix ? parseFloat(lastSlugSuffix) + 1 : 2;

      cb(null, `${slug}-${slugSuffix}`);
    });
  });

  schema.method('_pruneAliasSlug', function(aliasSlug, cb) {
    this.constructor.update({ aliasSlugs: aliasSlug }, {
      $pull: { aliasSlugs: aliasSlug }
    }, cb);
  });
};


module.exports = mongooseSlugs;
