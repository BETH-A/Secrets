///Required NPMs///
require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require('mongoose-findorcreate');
const config = require("./config.js");

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

///Initialize serializatoin & deserialization///
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

///Configure Google OAuth Strategy///
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://secrets-beth.herokuapp.com/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

///Configure Facebook OAuth///
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://secrets-beth.herokuapp.com/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


///Connect to MongoDB via Mongoose///
mongoose.connect("mongodb+srv://" + process.env.MONGODB_ID + process.env.MONGODB_PWD +"@secrets0-jcgh2.mongodb.net/userDB", {
useUnifiedTopology: true,
useNewUrlParser: true,
});

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

///DB Schema
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

///Enable plug-in for mongoose-local///
userSchema.plugin(passportLocalMongoose);

///Enable plug-in for mongoose-findOrCreate to work with Google OAuth20
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

User.collection.indexExists({ "username" : 1 }, function(err, results){
  console.log(results);
  if ( results === true) {
    // Dropping an Index in MongoDB
    User.collection.dropIndex( { "username" : 1 } , function(err, res) {
        if (err) {
            console.log('Error in dropping index!', err);
        }
    });
  } else {
    console.log("Index doesn't exisit!");
  }
});

///Config passport local///
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

///Routes///
app.get("/", function(req, res) {
  res.render("home")
});

  ///Google Auth Routes///
app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  }));

app.get("/auth/google/secrets",
  passport.authenticate("google", {failureRedirect: "/login"}), function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  });

  ///Facebook Auth Routes///
app.get("/auth/facebook", passport.authenticate("facebook"));

app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login"}), function(req, res) {
    res.redirect("/secrets");
  });

  ///Register Routes///
app.route("/register")
  .get(function(req, res) {
    res.render("register")
  })
  .post(function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
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

  ///Login Routes///
app.route("/login")
  .get(function(req, res) {
    res.render("login")
  })
  .post(function(req, res) {

    const user = new User({
      username: req.body.username,
      password: req.body.password
    });

    req.login(user, function(err) {
      if (err) {
        console.log(err);
        res.redirect("/")
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/secrets");
        });
      }
    });
  });

  ///Secrets Routes///
app.get("/secrets", function(req, res) {
  User.find({"secret": {$ne: null}}, function(err, foundUsers){
    if (err) {
      console.log(err);
    } else {
      if (foundUsers){
        res.render("secrets", {userWithSecrets: foundUsers});
      }
    }
  });
});

  ///Submit Routes///
app.route("/submit")
  .get(function( req, res){
    if (req.isAuthenticated()) {
      res.render("submit");
    } else {res.redirect("/login")}
  })
  .post(function(req, res) {
    const submittedSecret = req.body.secret;

    console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
      if (err){
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save(function(){
            res.redirect("/secrets");
          });
        }
      }
    });
  });

  ///Logout Route///
app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

///Sever Listening///
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server has started successfully.");
});
