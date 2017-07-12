Package.describe({
  name: 'fine-rest',
  version: '1.0.10',

  // Brief, one-line summary of the package.
  summary: 'A fine way to define server-side routes that return JSON',

  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/formspoint/fine-rest',

  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md',
});

Npm.depends({
  'connect': '2.30.2',
  'connect-route': '0.1.5',
});

Package.onUse(function (api) {
  api.versionsFrom('1.0');

  api.use([
    'accounts-base@1.2.0',
    'accounts-password',
    'connect': '2.30.2',
    'connect-route': '0.1.5',
    'check',
    'underscore',
    "fibers": "^2.0.0",
    'webapp',
  ], 'server');

  api.addFiles([
    'json-routes.js'
  ], 'server');

  api.export([
    'JsonRoutes'
  ], 'server');
});
