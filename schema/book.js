const Schema = require('mongoose').Schema

const bookSchema = new Schema({
  author: { type: String, required: true },
  title: { type: String, required: true },
  publishedDate: { type: Date }
})

module.exports = bookSchema
