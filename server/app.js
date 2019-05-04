const express = require('express');
const path = require('path');
const utils = require('./lib/hashUtils');
const partials = require('express-partials');
const bodyParser = require('body-parser');
const Auth = require('./middleware/auth');
const models = require('./models');
const db = require('./db/index');
const schema = require('../server/db/config.js');
const Promise = require('bluebird');

const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.use(partials());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', 
(req, res) => {
  res.render('index');
});

app.get('/create', 
(req, res) => {
  res.render('index');
});

app.get('/links', 
(req, res, next) => {
  models.Links.getAll()
    .then(links => {
      res.status(200).send(links);
    })
    .error(error => {
      res.status(500).send(error);
    });
});

app.post('/links', 
(req, res, next) => {
  var url = req.body.url;
  if (!models.Links.isValidUrl(url)) {
    // send back a 404 if link is not valid
    return res.sendStatus(404);
  }

  return models.Links.get({ url })
    .then(link => {
      if (link) {
        throw link;
      }
      return models.Links.getUrlTitle(url);
    })
    .then(title => {
      return models.Links.create({
        url: url,
        title: title,
        baseUrl: req.headers.origin
      });
    })
    .then(results => {
      return models.Links.get({ id: results.insertId });
    })
    .then(link => {
      throw link;
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(link => {
      res.status(200).send(link);
    });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/signup', 
(req, res) => {
  res.render('signup');
});

app.get('/login', 
(req, res) => {
  res.render('login');
});

app.post('/signup', (req, res) => {
  // get the client user name (req.body.username);

  // see if the client username exists in the database
  models.Users.get(req.body.username)
    .then((resolve, reject) => {
      // if it does, redirect them to the signup page
      console.log(resolve, reject);
      if (resolve) {
        res.redirect('/signup');
        res.end();
      } else {
        // if it doesn't, create a new user and re direct to the root page
        models.Users.create(req.body)
        .then((resolve, reject) => {
          // console.log("creating users");
          // console.log(resolve, reject)
          if(reject) {
            res.redirect('/signup');
            res.end();
          } else {
            res.redirect('/');
            res.end();
          }
        })
      }
    });  
});

app.post('/login', (req, res) => {
  models.Users.getAll(req.body.username)
    .then((resolve, reject) => {
      if (utils.compareHash(req.body.password, resolve[0].password, resolve[0].salt) === true) {
        console.log('match!');
        // go to /links if there's a match
        // res.render('index');
        res.redirect('/');
        res.end();
      } else {
        res.render('login');
        res.end();
      }
    })
});

/************************************************************/
// Handle the code parameter route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/:code', (req, res, next) => {

  return models.Links.get({ code: req.params.code })
    .tap(link => {

      if (!link) {
        throw new Error('Link does not exist');
      }
      return models.Clicks.create({ linkId: link.id });
    })
    .tap(link => {
      return models.Links.update(link, { visits: link.visits + 1 });
    })
    .then(({ url }) => {
      res.redirect(url);
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(() => {
      res.redirect('/');
    });
});

module.exports = app;
