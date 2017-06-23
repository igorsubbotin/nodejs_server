'use strict';

const server = require('./server');

var port = process.env.PORT || 3000;
var ip = process.env.IP || '127.0.0.1';
server.listen(port, ip, () => console.log(port, ip));