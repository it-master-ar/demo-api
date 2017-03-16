const Schema = require('mongoose').Schema
const mongooseSlugs = require('../lib/mongoose-slugs')

const bookSchema = new Schema({
  author: { type: String, required: true },
  title: { type: String, required: true },
  publishedDate: { type: Date }
})

bookSchema.plugin(mongooseSlugs)

module.exports = bookSchema
