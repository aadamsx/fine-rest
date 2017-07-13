
# This is [fine-rest](https://www.npmjs.com/package/fine-rest)

#### A fine way to define REST server-side routes in Meteor.
##### Make your Meteor app's data accessible over HTTP. Integrate your Meteor backend into a native mobile app or just query your data over HTTP from any client.
---
Install fine-rest in your Meteor project via npm:

```bash
$ meteor npm install --save fine-rest
```

Now use fine-rest in project like so:

```javascript
import { JsonRoutes } from 'fine-rest/json-routes';
```

A Meteor example application using fine-rest:

### [Meteor Web API Example](https://github.com/aadamsx/meteor-web-app-test)

---

### This package was formally the following Meteor packages, their functionality now rolled into one fine NPM package:

### [json-routes](#json-routes-1)
### [authenticate-user-by-token](#authenticate-user-by-token-1)
### [rest-accounts-password](#rest-accounts-password-1)
### [rest-bearer-token-parser](#rest-bearer-token-parser-1)
### [rest-json-error-handler](#rest-json-error-handler-1)

...
### [Change Log](#change-log-1)

---


# json-routes

A bare-bones way to define server-side JSON API endpoints, without
any extra functionality. Based on [connect-route].

### Example

```js
JsonRoutes.add("get", "/posts/:id", function (req, res, next) {
  var id = req.params.id;

  JsonRoutes.sendResult(res, {
    data: Posts.findOne(id)
  });
});
```

## API

### JsonRoutes.add(method, path, handler)

Add a server-side route that returns JSON.

- `method` - The HTTP method that this route should accept: `"get"`, `"post"`,
  etc. See the full list [here][connect-route L4]. The method name is
  case-insensitive, so `'get'` and `'GET'` are both acceptable.
- `path` - The path, possibly with parameters prefixed with a `:`. See the
  example.
- `handler(request, response, next)` - A handler function for this route.
  `request` is a Node request object, `response` is a Node response object,
  `next` is a callback to call to let the next middleware handle this route. You
  don't need to use this normally.

### JsonRoutes.sendResult(response, options)

Return data fom a route.

- `response` - Required. The Node response object you got as an argument to your handler function.
- `options.code` - Optional. The status code to send. `200` for OK, `500` for internal error, etc. Default is 200.
- `options.headers` - Optional. Dictionary of headers to send back.
- `options.data` - Optional. The data you want to send back. This is serialized to JSON with content type `application/json`. If `undefined`, there will be no response body.

## Errors

We recommend that you simply throw an Error or Meteor.Error from your handler function. You can then attach error handling middleware that converts those errors to JSON and sends the response. Here's how to do it with our default error middleware:

```js
JsonRoutes.ErrorMiddleware.use(
  '/widgets',
  RestMiddleware.handleErrorAsJson
);

JsonRoutes.add('get', 'widgets', function () {
  var error = new Meteor.Error('not-found', 'Not Found');
  error.statusCode = 404;
  throw error;
});
```

### JsonRoutes.setResponseHeaders(headerObj)

Set the default headers used by `JsonRoutes.sendResult` for the response. Default value is:

```js
{
  "Cache-Control": "no-store",
  "Pragma": "no-cache"
}
```

You can pass additional headers directly to `JsonRoutes.sendResult`

## Adding Middleware

If you want to insert connect middleware and ensure that it runs before your
REST route is hit, use `JsonRoutes.Middleware`.

```js
JsonRoutes.Middleware.use(function (req, res, next) {
  console.log(req.body);
  next();
});
```

## Creating Middleware Packages

Once you've created an awesome piece of reusable middleware and you're ready to
share it with the world, you should make it a Meteor package so it can be easily
configured in any JSON Routes API. There are only two requirements.
Actually, they're just very strong recommendations. Nothing will explode if you
don't follow these guidelines, but doing so should promote a much cleaner
middleware ecosystem.

Each middleware package should define a single middleware function and add it
to `RestMiddleware` namespace:

```js
RestMiddleware.someMiddlewareFunc = function (req, res, next) {
  // Do some awesome middleware stuff here
};

RestMiddleware.someMiddlewareErrorFunc = function (err, req, res, next) {
  // Do some awesome middleware error handling here
};
```

Alternatively, you could publish a pure NodeJS middleware package to NPM, and you will be able to require it and use it in your Meteor package or app.

### Auth Middleware

- By convention, any middleware you create that parses the request to find an authentication token should then save that token on `req.authToken`. See `rest-bearer-token-parser` for an example.
- By convention, any middleware you create that determines a user ID should save that ID on `req.userId`. See `authenticate-user-by-token` for an example.

---

# authenticate-user-by-token
Middleware for validating a Meteor.user's login token

## Middleware Name

This middleware can be accessed as:

**`JsonRoutes.Middleware.authenticateMeteorUserByToken`**

### Request Properties Required

- `request.authToken`
  - _String_
  - A valid login token for a `Meteor.user` account (requires `accounts-base`)

### Request Properties Modified

- `request.userId`
  - _String_
  - If the `request.authToken` is found in a user account, sets this to the ID of the authenticated user. Otherwise, `null`.

## Usage

Simply add this layer of middleware after any token parsing middleware, and voila!

For example:

```js
JsonRoutes.Middleware.use('/auth', JsonRoutes.Middleware.parseBearerToken);
JsonRoutes.Middleware.use('/auth', JsonRoutes.Middleware.authenticateMeteorUserByToken);

JsonRoutes.add('GET', 'auth/test', function (request, response) {
  // The authenticated user's ID will be set by this middleware
  var userId = request.userId;
});
```

---

# rest-accounts-password

## Log in and register password accounts over HTTP

If you have `accounts-password` in your app, and you want to be able to use it over HTTP, this is the package for you. Call these APIs to get an access token, and pass that token to API methods you defined with [`json-routes`](#json-routes-1) to call methods and publications that require login.

Make sure to serve your app over HTTPS if you are using this for login, otherwise people can hijack your passwords. Try the [`force-ssl` package](https://atmospherejs.com/meteor/force-ssl).

### POST /users/login, POST /users/register

The login and registration endpoints take the same inputs. Pass an object with the following properties:

- `username`
- `email`
- `password`

`password` is required, and you must have at least one of `username` or `email`.

#### Responses

Both login and registration have the same response format.

```js
// successful response, with HTTP code 200
{
  token: "string",
  tokenExpires: "ISO encoded date string",
  id: "user id"
}

// error response, with HTTP code 500
{
  error: "error-code",
  reason: "Human readable error string"
}
```

### Authentication

After adding this package, API endpoints accept a standard bearer token header (Based on [RFC 6750](http://tools.ietf.org/html/rfc6750#section-2.1) and [OAuth Bearer](http://self-issued.info/docs/draft-ietf-oauth-v2-bearer.html#authz-header)).

```http
Authorization: Bearer <token>
```

Here is how you could use Meteor's `http` package to call a method as a logged in user. Inside the method, the current user can be accessed the exact same way as in a normal method call, through `this.userId`.

```js
HTTP.post("/methods/return-five-auth", {
  headers: { Authorization: "Bearer " + token }
}, function (err, res) {
  console.log(res.data); // 5
});
```

---

# rest-bearer-token-parser

Middleware for parsing a standard bearer token from an HTTP request

### Middleware Name

This middleware can be accessed as:

**`JsonRoutes.Middleware.parseBearerToken`**

### Request Properties Required

- None

### Request Properties Modified

- `request.authToken`
  - _String_
  - The parsed bearer token, or `null` if none is found

## Usage

Accepts tokens passed via the standard header or URL query parameter (whichever is found first, in that order).

The header signature is: `Authorization: Bearer <token>`

The query signature is: `?access_token=<token>`

---

## rest-json-error-handler

Middleware for converting thrown Meteor.Errors to JSON and sending the response.

## Usage

Handle errors from all routes:

```js
JsonRoutes.ErrorMiddleware.use(RestMiddleware.handleErrorAsJson);
```

Handle errors from one route:

```js
JsonRoutes.ErrorMiddleware.use(
  '/handle-error',
  RestMiddleware.handleErrorAsJson
);
```

## Example

```js
JsonRoutes.ErrorMiddleware.use(
  '/handle-error',
  RestMiddleware.handleErrorAsJson
);

JsonRoutes.add('get', 'handle-error', function () {
  var error = new Meteor.Error('not-found', 'Not Found');
  error.statusCode = 404;
  throw error;
});
```



---

# Change Log


#### 1.0.0 - 1.0.12

- Refactored code and converted over `JsonRoutes` & related packages to NPM fine-rest
