import Fiber from 'fibers';
import connect from 'connect';
import connectRoute from 'connect-route';

import { Mongo, MongoInternals } from 'meteor/mongo';

JsonRoutes = {};

WebApp.connectHandlers.use(connect.urlencoded({limit: '50mb'})); //Override default request size
WebApp.connectHandlers.use(connect.json({limit: '50mb'})); //Override default request size
WebApp.connectHandlers.use(connect.query());

// Handler for adding middleware before an endpoint (JsonRoutes.middleWare
// is just for legacy reasons). Also serves as a namespace for middleware
// packages to declare their middleware functions.
JsonRoutes.Middleware = JsonRoutes.middleWare = connect();
WebApp.connectHandlers.use(JsonRoutes.Middleware);

// List of all defined JSON API endpoints
JsonRoutes.routes = [];

// Save reference to router for later
var connectRouter;

// Register as a middleware
WebApp.connectHandlers.use(Meteor.bindEnvironment(connectRoute(function (router) {
  connectRouter = router;
})));

// Error middleware must be added last, to catch errors from prior middleware.
// That's why we cache them and then add after startup.
var errorMiddlewares = [];
JsonRoutes.ErrorMiddleware = {
  use: function () {
    errorMiddlewares.push(arguments);
  },
};






/**
 * Parses bearer token from the incoming request
 *
 * Accepts tokens passed via the standard headers, URL query parameters, or
 * request body (whichever is found first, in that order).
 *
 * Stores the token in req.authToken for later middleware.
 *
 * The header signature is: "Authorization: Bearer <token>".
 *
 * The query signature is: "?access_token=<token>"
 *
 * @middleware
 */
JsonRoutes.Middleware.parseBearerToken = (req, res, next) => {
  req.authToken = parseHeaders(req) || parseQuery(req);
  next();
};

/**
 * Parses bearer token from the Authorization header
 *
 * @param req {Object} The incoming Connect request
 * @returns {String} The bearer token
 * @private
 */
function parseHeaders(req) {
  if (req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');

    if (parts.length === 2) {
      const scheme = parts[0];
      const credentials = parts[1];

      if (/^Bearer$/i.test(scheme)) {
        return credentials;
      }
    }
  }
}

/**
 * Parses bearer token from URL query parameters
 *
 * @param req {Object} The incoming Connect request
 * @returns {String} The bearer token
 */
function parseQuery(req) {
  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  if (req.query && req.query.access_token) {
    return req.query.access_token;
  }

  // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
}


// *************


/**
 * SimpleRest middleware for validating a Meteor.user's login token
 *
 * This middleware must be processed after the request.token has been set to a
 * valid login token for a Meteor.user account (from a separate layer of
 * middleware). If authentication is successful, the request.userId will be set
 * to the ID of the authenticated user.
 *
 * @middleware
 */
JsonRoutes.Middleware.authenticateMeteorUserByToken =
  (req, res, next) => {
    Fiber(() => {
      const userId = getUserIdFromAuthToken(req.authToken);
      if (userId) {
        req.userId = userId;
      }

      next();
    }).run();
  };

/**
 * Retrieves the ID of the Meteor.user that the given auth token belongs to
 *
 * @param token An unhashed auth token
 * @returns {String} The ID of the authenticated Meteor.user, or null if token
 *     is invalid
 */
function getUserIdFromAuthToken(token) {
  if (!token) return null;

  const driver = new MongoInternals.RemoteCollectionDriver(Meteor.settings[dbId]); // must have the database URL in your settings.json file
  const users = new Mongo.Collection("users", { _driver: driver, _suppressSameNameError: true });

  const user = users.findOne({ 'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(token) }, { fields: { _id: 1 } });
  if (user) return user._id;

  return null;
}

// *************

RestMiddleware = {};



// import RestMiddleware from 'middleware';
/**
 * Handle any connect errors with a standard JSON response
 *
 * Response looks like:
 *   {
 *     error: 'Error type',
  *    reason: 'Cause of error'
  *  }
 *
 * @middleware
 */
RestMiddleware.handleErrorAsJson = (err, request, response, next) => { // jshint ignore:line
  // If we at least put in some effort to throw a user-facing Meteor.Error,
  // the default code should be less severe
  if (err.sanitizedError && err.sanitizedError.errorType === 'Meteor.Error') {
    if (!err.sanitizedError.statusCode) {
      err.sanitizedError.statusCode = err.statusCode || 400;
    }

    err = err.sanitizedError;
  } else if (err.errorType === 'Meteor.Error') {
    if (!err.statusCode) err.statusCode = 400;
  } else {
    // Hide internal error details
    // XXX could check node_env here and return full
    // error details if development
    const statusCode = err.statusCode;
    err = new Error();
    err.statusCode = statusCode;
  }

  // If an error has a `data` property, we
  // send that. This allows packages to include
  // extra client-safe data with the errors they throw.
  var body = {
    error: err.error || 'internal-server-error',
    reason: err.reason || 'Internal server error',
    details: err.details,
    data: err.data,
  };

  body = JSON.stringify(body, null, 2);

  response.statusCode = err.statusCode || 500;
  response.setHeader('Content-Type', 'application/json');
  response.write(body);
  response.end();
};


// *************


JsonRoutes.Middleware.use(JsonRoutes.Middleware.parseBearerToken);
JsonRoutes.Middleware.use(JsonRoutes.Middleware.authenticateMeteorUserByToken);

// Handle errors specifically for the login routes correctly
JsonRoutes.ErrorMiddleware.use('/users/login', RestMiddleware.handleErrorAsJson);
JsonRoutes.ErrorMiddleware.use('/users/token-login', RestMiddleware.handleErrorAsJson);
JsonRoutes.ErrorMiddleware.use('/users/register', RestMiddleware.handleErrorAsJson);



// *************




Meteor.startup(function () {
  _.each(errorMiddlewares, function (errorMiddleware) {
    errorMiddleware = _.map(errorMiddleware, function (maybeFn) {
      if (_.isFunction(maybeFn)) {
        // A connect error middleware needs exactly 4 arguments because they use fn.length === 4 to
        // decide if something is an error middleware.
        return function (a, b, c, d) {
          Meteor.bindEnvironment(maybeFn)(a, b, c, d);
        }
      }

      return maybeFn;
    });

    WebApp.connectHandlers.use.apply(WebApp.connectHandlers, errorMiddleware);
  });

  errorMiddlewares = [];
});

JsonRoutes.add = function (method, path, handler) {
  // Make sure path starts with a slash
  if (path[0] !== '/') {
    path = '/' + path;
  }

  // Add to list of known endpoints
  JsonRoutes.routes.push({
    method: method,
    path: path,
  });

  connectRouter[method.toLowerCase()](path, function (req, res, next) {
    // Set headers on response
    setHeaders(res, responseHeaders);
    Fiber(function () {
      try {
        handler(req, res, next);
      } catch (error) {
        next(error);
      }
    }).run();
  });
};

var responseHeaders = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

JsonRoutes.setResponseHeaders = function (headers) {
  responseHeaders = headers;
};


// *********************


JsonRoutes.add('options', '/users/login', (req, res) => {
  JsonRoutes.sendResult(res);
});

JsonRoutes.add('post', '/users/login', (req, res) => {
  const options = req.body;

  let user;
  if (options.hasOwnProperty('email') && options.hasOwnProperty('dbId')) {
    check(options, {
      email: String,
      password: String,
      dbId: String
    });
    const driver = new MongoInternals.RemoteCollectionDriver(Meteor.settings[dbId]); // must have the database URL in your settings.json file
    const users = new Mongo.Collection("users", { _driver: driver, _suppressSameNameError: true });
    user = users.findOne({ 'emails.address': options.email });
  } else if (options.hasOwnProperty('username') && options.hasOwnProperty('dbId')) {
    check(options, {
      username: String,
      password: String,
      dbId: String
    });
    const driver = new MongoInternals.RemoteCollectionDriver(Meteor.settings[dbId]); // must have the database URL in your settings.json file
    const users = new Mongo.Collection("users", { _driver: driver, _suppressSameNameError: true });
    user = users.findOne({ username: options.username });
  } else if (options.hasOwnProperty('email')) {
    check(options, {
      email: String,
      password: String
    });
    const users = new Mongo.Collection("users");
    user = users.findOne({ 'emails.address': options.email });
  } else if (options.hasOwnProperty('username')) {
    check(options, {
      username: String,
      password: String
    });
    const users = new Mongo.Collection("users");
    user = users.findOne({ username: options.username });
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

  const hashedToken = Accounts._hashStampedToken(stampedLoginToken);
  users.update({ _id: result.userId }, { $addToSet: { "services.resume.loginTokens": hashedToken } });

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


JsonRoutes.add('options', '/users/token-login', (req, res) => {
  JsonRoutes.sendResult(res);
});

JsonRoutes.add('post', '/users/token-login', (req, res) => {
  const options = req.body;

  let multiMode = true;
  if (options.hasOwnProperty('dbId')) {
    check(options, {
      dbId: String,
      loginToken: String
    });
  } else {
    multiMode = false
    check(options, {
      loginToken: String
    });
  }

  const dbId = options.dbId;
  const loginToken = options.loginToken;

  let users = null;
  if (multiMode) {
    const driver = new MongoInternals.RemoteCollectionDriver(Meteor.settings[dbId]); // must have the database URL in your settings.json file
    users = new Mongo.Collection("users", { _driver: driver, _suppressSameNameError: true });
  }
  else {
    users = new Mongo.Collection("users");
  }
  let user = users.findOne({ 'services.login.token': loginToken });

  // No user, in the wrong, could be invalid userId or database, or event token.
  if (!user) {
    throw new Meteor.Error('not-found',
      'User with that login token not found.');
  }

  // We have a valid user, now assign the id to a variable.
  const userId = user._id;

  // You're done with this one-time login token, now throw it away so it can't be used again.
  users.update({ _id: userId }, { $unset: { 'services.login.token': '' } });

  // Generate the stamped token and add it to the user collection
  const stampedLoginToken = Accounts._generateStampedLoginToken();
  check(stampedLoginToken, {
    token: String,
    when: Date,
  });

  const hashedToken = Accounts._hashStampedToken(stampedLoginToken);
  users.update({ _id: userId }, { $addToSet: { "services.resume.loginTokens": hashedToken } });

  const tokenExpiration = Accounts._tokenExpiration(stampedLoginToken.when);
  check(tokenExpiration, Date);

  JsonRoutes.sendResult(res, {
    data: {
      id: userId,
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


// ********************


/**
 * Sets the response headers, status code, and body, and ends it.
 * The JSON response will be pretty printed if NODE_ENV is `development`.
 *
 * @param {Object} res Response object
 * @param {Object} [options]
 * @param {Number} [options.code] HTTP status code. Default is 200.
 * @param {Object} [options.headers] Dictionary of headers.
 * @param {Object|Array|null|undefined} [options.data] The object to
 *   stringify as the response. If `null`, the response will be "null".
 *   If `undefined`, there will be no response body.
 */
JsonRoutes.sendResult = function (res, options) {
  options = options || {};

  // We've already set global headers on response, but if they
  // pass in more here, we set those.
  if (options.headers) setHeaders(res, options.headers);

  // Set status code on response
  res.statusCode = options.code || 200;

  // Set response body
  writeJsonToBody(res, options.data);

  // Send the response
  res.end();
};

function setHeaders(res, headers) {
  _.each(headers, function (value, key) {
    res.setHeader(key, value);
  });
}

function writeJsonToBody(res, json) {
  if (json !== undefined) {
    var shouldPrettyPrint = (process.env.NODE_ENV === 'development');
    var spacer = shouldPrettyPrint ? 2 : null;
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(json, null, spacer));
  }
}

module.exports.JsonRoutes = JsonRoutes;
module.exports.RestMiddleware = RestMiddleware;
