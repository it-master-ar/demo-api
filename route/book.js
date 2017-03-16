const Router = require('express').Router;
const router = new Router();


function createBook(req, res, next) {
  req.logger.info('Creating book', req.body);

  req.model('Book').create(req.body, (err, book) => {
    if (err) { return next(err); }

    req.logger.verbose('Sending book to client');
    res.sendCreated(book);
  });
}

function queryBooks(req, res, next) {
  req.logger.info('Querying books', req.query);
  req.model('Book').countAndFind(req.query)
    .skip(req.skip)
    .limit(req.limit)
    .sort(req.sort)
    .lean()
    .exec((err, books, bookCount) => {
      if (err) { return next(err); }

      req.logger.verbose('Sending book to client');
      res.sendQueried(books, bookCount);
    });
}

function findBookById(req, res, next) {
  req.logger.info('Finding book with id %s', req.params.id);
  req.model('Book').findById(req.params.id)
    .lean()
    .exec((err, book) => {
      if (err) { return next(err); }
      if (!book) { return res.status(404).end(); }

      req.logger.verbose('Sending book to client');
      res.sendFound(book);
    });
}

function findBookBySlug(req, res, next) {
  req.logger.info('Finding book with slug %s', req.params.slug);
  req.model('Book').findBySlug(req.params.slug)
    .lean()
    .exec((err, book) => {
      if (err) { return next(err); }
      if (!book) { return res.status(404).end(); }

      req.logger.verbose('Sending book to client');
      res.sendFound(book);
    });
}

function updateBookById(req, res, next) {
  req.logger.info('Updating book with id %s', req.params.id);
  req.model('Book').update({
    _id: req.params.id
  }, req.body, (err, results) => {
    if (err) { return next(err); }

    if (results.n < 1) {
      req.logger.verbose('Book not found');
      return res.status(404).end();
    }
    req.logger.verbose('Book updated');
    res.status(204).end();
  });
}

function removeBookById(req, res, next) {
  req.logger.info('Removing book with id %s', req.params.id);
  req.model('Book').remove({
    _id: req.params.id
  }, (err, results) => {
    if (err) { return next(err); }

    if (results.nModified < 1) {
      req.logger.verbose('Book not found');
      return res.status(404).end();
    }
    req.logger.verbose('Book removed');
    res.status(204).end();
  });
}

function restoreBookById(req, res, next) {
  req.logger.info('Restoring book with id %s', req.params.id);
  req.model('Book').restore({
    _id: req.params.id
  }, (err, results) => {
    if (err) { return next(err); }

    if (results.nModified < 1) {
      req.logger.verbose('Book not found');
      return res.status(404).end();
    }
    req.logger.verbose('Book restored');
    res.status(204).end();
  });
}

router.post(  '/',                  createBook);
router.get(   '/',                  queryBooks);
router.get(   '/:id([0-9a-f]{24})', findBookById);
router.get(   '/:slug',             findBookBySlug);
router.put(   '/:id',               updateBookById);
router.delete('/:id',               removeBookById);
router.post(  '/restore/:id',       restoreBookById);


module.exports = router;
