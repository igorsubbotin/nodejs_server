'use strict';

const url = require('url');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mime = require('mime');

const root = __dirname;
const indexFilepath = path.join(root, 'public/index.html');
const filesRoot = path.join(root, "files");
const limitFileSize = 1024 * 1024;

module.exports = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURI(url.parse(req.url).pathname);
  } catch (e) {
    res.statusCode = 300;
    res.end('Bad request');
    return;
  }
  
  if (req.method == 'GET' && pathname == '/') {
    sendFile(indexFilepath, res);
    return;
  }
  
  let filename = pathname.slice(1);
  if (filename.includes('/') || filename.includes('..')) {
    res.statusCode = 400;
    res.end('Nested paths are not allowed');
    return;
  } 

  switch(req.method) {
    case 'GET':
      let filepath = path.join(filesRoot, filename);
      sendFile(filepath, res);
      break;
    
    case 'POST':
      if (!filename) {
        res.statusCode = 404;
        res.end('File not found');
        return;
      }
      receiveFile(path.join(filesRoot, filename), req, res); 
      break;

    case 'DELETE':
      if (!filename) {
        res.statusCode = 404;
        res.end('File not found');
        return;
      }
      deleteFile(path.join(filesRoot, filename), res);
      break;

    default:
      res.statusCode = 502;
      res.end("Not implemented");
      break;
  }
});

function sendFile(filepath, res) {
  let fileStream = fs.createReadStream(filepath);
  fileStream.pipe(res);

  fileStream
    .on('error', err => {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('File not found');
      } else {
        console.error(err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Server error');
        } else {
          res.end();
        }

      }
    })
    .on('open', () => {
      res.setHeader('Content-Type', mime.lookup(filepath));
    });

  res
    .on('close', () => {
      fileStream.destroy();
    });
}

function receiveFile(filepath, req, res) {
  if (req.headers['content-length'] > limitFileSize) {
    res.statusCode = 413;
    res.end('File is too big!');
    return;
  }

  let size = 0;
  let writeStream = new fs.WriteStream(filepath, {flags: 'wx'});

  req
    .on('data', chunk => {
      size += chunk.length;

      if (size > limitFileSize) {
        res.statusCode = 413;
        res.setHeader('Connection', 'close');
        res.end('File is too big!');
        writeStream.destroy();
        fs.unlink(filepath, err => { // eslint-disable-line
          /* ignore error */
        });

      }
    })
    .on('close', () => {
      writeStream.destroy();
      fs.unlink(filepath, err => { // eslint-disable-line
        /* ignore error */
      });
    })
    .pipe(writeStream);

  writeStream
    .on('error', err => {
      if (err.code === 'EEXIST') {
        res.statusCode = 409;
        res.end('File exists');
      } else {
        console.error(err);
        if (!res.headersSent) {
          res.writeHead(500, {'Connection': 'close'});
          res.write('Internal error');
        }
        fs.unlink(filepath, err => { // eslint-disable-line
          /* ignore error */
          res.end();
        });
      }

    })
    .on('close', () => {
      res.end('OK');
    });
} 

function deleteFile(filepath, res) {
  fs.unlink(filepath, err => {
    if (err) {
      res.statusCode = 500;
      res.body = 'Server error';
    }
    res.end();
  });
}