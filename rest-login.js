// import RestMiddleware.handleErrorAsJson from 'json_error_handler';
// import JsonRoutes.Middleware.authenticateMeteorUserByToken from 'auth';
// import JsonRoutes.Middleware.parseBearerToken from 'bearer_token_parser';
// import JsonRoutes from 'json-routes';

JsonRoutes.Middleware.use(JsonRoutes.Middleware.parseBearerToken);
JsonRoutes.Middleware.use(JsonRoutes.Middleware.authenticateMeteorUserByToken);

// Handle errors specifically for the login routes correctly
JsonRoutes.ErrorMiddleware.use('/users/login', RestMiddleware.handleErrorAsJson);
JsonRoutes.ErrorMiddleware.use('/users/register', RestMiddleware.handleErrorAsJson);

JsonRoutes.add('options', '/users/login', (req, res) => {
  JsonRoutes.sendResult(res);
});

JsonRoutes.add('post', '/users/login', (req, res) => {
  const options = req.body;

  let user;
  if (options.hasOwnProperty('email')) {
    check(options, {
      email: String,
      password: String,
    });
    user = Meteor.users.findOne({ 'emails.address': options.email });
  } else {
    check(options, {
      username: String,
      password: String,
    });
    user = Meteor.users.findOne({ username: options.username });
  }

  if (!user) {
    throw new Meteor.Error('not-found',
      'User with that username or email address not found.');
  }

  const result = Accounts._checkPassword(user, options.password);
  check(result, {
    userId: String,
    error: Match.Optional(Meteor.Error),
  });

  if (result.error) {
    throw result.error;
  }

  const stampedLoginToken = Accounts._generateStampedLoginToken();
  check(stampedLoginToken, {
    token: String,
    when: Date,
  });

  Accounts._insertLoginToken(result.userId, stampedLoginToken);

  const tokenExpiration = Accounts._tokenExpiration(stampedLoginToken.when);
  check(tokenExpiration, Date);

  JsonRoutes.sendResult(res, {
    data: {
      id: result.userId,
      token: stampedLoginToken.token,
      tokenExpires: tokenExpiration,
    },
  });

});

JsonRoutes.add('options', '/users/register', (req, res) => {
  JsonRoutes.sendResult(res);
});

JsonRoutes.add('post', '/users/register', (req, res) => {
  if(Accounts._options.forbidClientAccountCreation) {
    JsonRoutes.sendResult(res, {code: 403});
  } else {
    const options = req.body;

    check(options, {
      username: Match.Optional(String),
      email: Match.Optional(String),
      password: String,
    });

    const userId = Accounts.createUser(
      _.pick(options, 'username', 'email', 'password'));

    // Log in the new user and send back a token
    const stampedLoginToken = Accounts._generateStampedLoginToken();
    check(stampedLoginToken, {
      token: String,
      when: Date,
    });

    // This adds the token to the user
    Accounts._insertLoginToken(userId, stampedLoginToken);

    const tokenExpiration = Accounts._tokenExpiration(stampedLoginToken.when);
    check(tokenExpiration, Date);

    // Return the same things the login method returns
    JsonRoutes.sendResult(res, {
      data: {
        token: stampedLoginToken.token,
        tokenExpires: tokenExpiration,
        id: userId,
      },
    });
  }
});
