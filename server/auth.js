// server/auth.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');

function configureAuth(app, options) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, JWT_SECRET, SESSION_SECRET } = options;

  app.use(require('cookie-parser')());
  app.use(require('express-session')({ secret: SESSION_SECRET || 'sessionsecret', resave: false, saveUninitialized: false }));

  passport.use(new GoogleStrategy({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL
    },
    function(accessToken, refreshToken, profile, cb) {
      // Minimal profile -> sign JWT
      const user = {
        id: profile.id,
        displayName: profile.displayName,
        avatar: profile.photos?.[0]?.value || null,
        email: profile.emails?.[0]?.value || null
      };
      return cb(null, user);
    }
  ));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  app.use(passport.initialize());
  app.use(passport.session());

  // routes
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth/failure' }), (req, res) => {
    // Create JWT and redirect to front-end with token
    const payload = { id: req.user.id, name: req.user.displayName, avatar: req.user.avatar, email: req.user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Redirect with token (fragm or query). We'll use fragment to avoid server logs.
    const redirectTo = `${options.frontendOrigin}/?token=${token}`;
    res.redirect(redirectTo);
  });

  app.get('/auth/failure', (req, res) => {
    res.status(401).send('Auth Failed');
  });

  // optional endpoint to verify JWT
  app.get('/me', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).send({ error: 'missing token' });
    const token = auth.replace('Bearer ', '');
    try {
      const data = jwt.verify(token, JWT_SECRET);
      res.send(data);
    } catch (err) {
      res.status(401).send({ error: 'invalid token' });
    }
  });
}

module.exports = { configureAuth };
