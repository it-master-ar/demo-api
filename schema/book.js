const Schema        = require('mongoose').Schema;
const mongooseSlugs = require('../lib/mongoose-slugs');


const bookSchema = new Schema({
  title: { type: String },
  body:  { type: String }
});

bookSchema.plugin(mongooseSlugs);


module.exports = bookSchema;
