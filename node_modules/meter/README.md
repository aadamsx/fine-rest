Meter
==========================
A middleware for limiting number of requests per second to an HTTP server from a given client IP address. Can be used anywhere that the (req, res, next) signature is used.

###Usage
    var express = require('express');
    var app = express();

    var meter = require('meter');

    app.use(meter());

	app.get('/hi', meter(10), function(req, res){
        res.send('Hi');
    });

    app.get('/hey', meter({rate:20}), function(req, res){
        res.send('Hey');
    });
    
###Options
	rate - reqs/sec - default 25
	