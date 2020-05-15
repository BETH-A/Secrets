///Required NPMs///
require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');



///Access NPMs///
const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

///Initialize for express-session///
app.use(session({
  secret: 'My secret catchphase.',
  resave: false,
  saveUninitialized: false
}))

///Initialize passport///
app.use(passport.initialize());
app.use(passport.session());

///Connect to MongoDB via Mongoose///
mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

///DB Schema
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
});

///Enable plug-in for mongoose-local///
userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

///Config passport local///
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

///Routes///
app.get("/", function(req, res) {
  res.render("home")
});

app.route("/register")
  .get(function(req, res) {
    res.render("register")
  })
  .post(function(req, res) {
    User.register({
      username: req.body.username
    }, req.body.password, function(err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/secrets");
        });
      }
    });
  });

app.route("/login")
  .get(function(req, res) {
    res.render("login")
  })
  .post(function(req, res) {

      const user = new User({
        username: req.body.username,
        password: req.body.password
      });

      req.login(user, function(err){
        if (err) {
          console.log(err);
        } else {
          passport.authenticate("local")(req, res, function(){
            res.redirect("/secrets");
          });
        }
      });
    });

app.get("/secrets", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("secrets");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});


app.listen(3000, function() {
  console.log("Server is listening on port 3000.");
});
