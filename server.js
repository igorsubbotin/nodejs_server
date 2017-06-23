const url = require('url');
const fs = require('fs');
const path = require('path');
const http = require('http');

module.exports = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURI(url.parse(req.url).pathname);
  } catch (e) {
    res.statusCode = 300;
    res.end('Bad request');
    return;
  }

  if (~pathname.indexOf('\0')) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  switch(req.method) {
    case 'GET':
      if (pathname == '/') {
        sendFile('/public/index.html', res);
        return;
      }
      
      sendResourceFile(pathname, res);
      break;
    
    case 'POST':
      saveResourceFile(pathname, req, res);
      break;

    case 'DELETE':
      deleteResourceFile(pathname, res);
      break;

    default:
      res.statusCode = 502;
      res.end("Not implemented");
      break;
  }
});

function sendResourceFile(pathname, res) {
  pathname = getResourcePathname(pathname);
  if (!pathname) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  sendFile(pathname, res);
}

function sendFile(pathname, res) {
  var mime = require('mime').lookup(pathname);
  res.setHeader('Content-Type', mime + "; charset=utf-8");
  pathname = getFullPathname(pathname);

  fs.stat(pathname, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end("File not found");
      return;
    }

    let file = fs.createReadStream(pathname);
    console.log("Sending file: " + pathname);

    file.pipe(res);

    file.on('error', (err) => {
      res.statusCode = 500;
      res.end('Server error');
      console.error(err);
    })

    res.on('close', () => {
      file.destroy();
    })
  });
}

function saveResourceFile(pathname, req, res) {
  let maxSize = 1024 * 1024;
  let size = req.headers['content-length'];
  if (size > maxSize) {
    console.log('Resource stream exceeded limit (' + size + ')');
    res.statusCode = 413;
    res.end("File is too big to upload");
    return;
  }

  pathname = getResourcePathname(pathname);
  if (!pathname) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  pathname = getFullPathname(pathname);
  
  fs.stat(pathname, (err, stats) => {
    if (err == null) {
      res.statusCode = 409;
      res.end("File already exists");
      return;
    }

    let file = fs.createWriteStream(pathname), size = 0;
    console.log("Uploading file: " + pathname);
    req.on('data', function(data) {
        size += data.length;
        if (size > maxSize) {
            res.statusCode = 413;
            res.end("File is too big to upload");
            // Question: How to stop the pipe here and delete file (in case if req.headers['content-length'] check
            // didn't work out and we got to this place)?
        }
    });
    req.pipe(file);   
    res.end();
  });
}

function deleteResourceFile(pathname, res) {
  pathname = getResourcePathname(pathname);
  if (!pathname) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  pathname = getFullPathname(pathname);

  fs.stat(pathname, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end("File not found");
      return;
    }

    fs.unlink(pathname, (err) => {
      if (err) {
        res.statusCode = 500;
        res.end("Server error");
        return;
      }
      console.log("File deleted: " + pathname);
      res.end();
    });
  });
}

function getResourcePathname(pathname) {
  pathname = path.join("/files", pathname);
  if (pathname != path.join("/files", path.basename(pathname))) {
    return null;
  }
  return pathname;
}

function getFullPathname(pathname) {
  return path.normalize(path.join(__dirname, pathname));
}