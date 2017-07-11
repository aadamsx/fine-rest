/* global JsonRoutes:true */

import Fiber from 'fibers/fibers';
import Future from 'fibers/future';

const connect = Npm.require('connect');
const connectRoute = Npm.require('connect-route');

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
let connectRouter;

// Register as a middleware
WebApp.connectHandlers.use(Meteor.bindEnvironment(connectRoute(router => {
  connectRouter = router;
})));

// Error middleware must be added last, to catch errors from prior middleware.
// That's why we cache them and then add after startup.
let errorMiddlewares = [];
JsonRoutes.ErrorMiddleware = {
  use() {
    errorMiddlewares.push(arguments);
  },
};

Meteor.startup(() => {
  _.each(errorMiddlewares, errorMiddleware => {
    errorMiddleware = _.map(errorMiddleware, maybeFn => {
      if (_.isFunction(maybeFn)) {
        // A connect error middleware needs exactly 4 arguments because they use fn.length === 4 to
        // decide if something is an error middleware.
        return (a, b, c, d) => {
          Meteor.bindEnvironment(maybeFn)(a, b, c, d);
        }
      }

      return maybeFn;
    });

    WebApp.connectHandlers.use(...errorMiddleware);
  });

  errorMiddlewares = [];
});

JsonRoutes.add = (method, path, handler) => {
  // Make sure path starts with a slash
  if (path[0] !== '/') {
    path = `/${path}`;
  }

  // Add to list of known endpoints
  JsonRoutes.routes.push({
    method,
    path,
  });

  connectRouter[method.toLowerCase()](path, (req, res, next) => {
    // Set headers on response
    setHeaders(res, responseHeaders);
    Fiber(() => {
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

JsonRoutes.setResponseHeaders = headers => {
  responseHeaders = headers;
};

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
JsonRoutes.sendResult = (res, options) => {
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
  _.each(headers, (value, key) => {
    res.setHeader(key, value);
  });
}

function writeJsonToBody(res, json) {
  if (json !== undefined) {
    const shouldPrettyPrint = (process.env.NODE_ENV === 'development');
    const spacer = shouldPrettyPrint ? 2 : null;
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(json, null, spacer));
  }
}

export JsonRoutes;
