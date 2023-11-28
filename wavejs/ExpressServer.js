const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const session = require('./session');

const Logger = require('./logger');

const contentTypes = {
  '.flv': 'video/x-flv',
  '.mp4': 'video/mp4',
  '.m3u8': 'application/x-mpegURL',
  '.mpd': 'application/dash+xml',
};


class ExpressServer {
  constructor() {
    this.config = {
      port: 3000,
      endpoint: 'wavejs'
    }
    this.app = express();
    this.session = session;
    this.app.disable('x-powered-by');
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    this.app.use(Logger.expressHttpLogger);

  }
  listen(port = this.config.port) {
    if(port) this.configureOutput({port: port});
    this.registerRoutes();
    this.server = http.createServer(this.app);
    console.l
    this.server.listen(this.config.port, () => {
      console.log(`🚀 Express blasting off at http://localhost:${this.config.port}/${this.config.endpoint}`);
    });
  }
  close() {
    this.server.close();
  }
  configureOutput({ port, endpoint}) {
    if (typeof port === 'number' && String(port).length === 4) this.config.port = port;
    if (typeof endpoint === 'string' && endpoint.length > 2) this.config.endpoint = endpoint;
  }
  registerRoutes() {
    this.app.get(`/${this.config.endpoint}/:streamId/:m3u8`, (req, res) => {
      //this is the area where we need to connect fmpg to the server
      Logger.debug(`endpoint: ${this.config.endpoint}/${req.params.streamId}/${req.params.m3u8}`)
      const stream = session.getStream(req.params.streamId);
      Logger.debug(`stream: ${JSON.stringify(stream)}`)
      const videoPath = `${stream.address}/${req.params.m3u8}`;
      Logger.debug(`videoPath: ${videoPath}`)
      //'application/vnd.apple.mpegurl'
      res.status(200).set('Content-Type', contentTypes['.m3u8']);
      fs.createReadStream(videoPath).pipe(res);
    });
    this.app.all('*', (req, res, next) => {
      Logger.error(`404: ${req.baseUrl}`)
      res.status(404).send("😵 Can't find what you're looking for!");
    });
    this.app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).send('☠️ Something Broke!');
    });
  }
  debug() {
    this.app.get('/streams', (req, res) => {
      res.status(200).json(Object.fromEntries(session.streams));
    });
  }
}


// const expressServer = {}

// expressServer.config = {
//   port: 3000,
//   endpoint: 'wavejs'
// }

// expressServer.start = (session, endpoint) => {
//   /* initial config */
//   app.disable('x-powered-by');

//   app.use(express.urlencoded({ extended: true }));
//   app.use(express.json());
//   app.use(expressHttpLogger);

//   app.get('/streams', (req, res) => {
//     res.status(200).json(Object.fromEntries(session.streams));
//   });

//   expressServer.registerEndpoint(session, endpoint);

//   app.use((req, res, next) => {
//     res.status(404).send("😵 Can't find what you're looking for!");
//   });

//   app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).send('☠️ Something Broke!');
//   });

//   let server = http.createServer(app);

//   server.listen(PORT, () => {
//     console.log(`🚀 Express blasting off on port ${PORT}`);
//   });
// };

// expressServer.registerEndpoint = (session, endpoint) => {
//   app.get(`/${endpoint}/:streamId/:m3u8`, (req, res) => {
//     //this is the area where we need to connect fmpg to the server
//     const stream = session.getStream(req.params.streamId);
//     const videoPath = `${stream.address}/${req.params.m3u8}`;
//     //'application/vnd.apple.mpegurl'
//     res.status(200).set('Content-Type', contentTypes['.m3u8']);
//     fs.createReadStream(videoPath).pipe(res);
//   });
// };

// const expressServer = (session, endpoint) => {
//   const app = express();

//   /* initial config */
//   app.disable('x-powered-by');

//   app.use(express.urlencoded({ extended: true }));
//   app.use(express.json());
//   app.use(expressHttpLogger);

//   app.get('/streams', (req, res) => {
//     res.status(200).json(Object.fromEntries(session.streams));
//   });

//   //get playlist route
//   app.get(`/${endpoint}/:streamId/:m3u8`, (req, res) => {
//     //this is the area where we need to connect fmpg to the server
//     const stream = session.getStream(req.params.streamId);
//     const videoPath = `${stream.address}/${req.params.m3u8}`;
//     //'application/vnd.apple.mpegurl'
//     res.status(200).set('Content-Type', contentTypes['.m3u8']);
//     fs.createReadStream(videoPath).pipe(res);
//   });

//   app.use((req, res, next) => {
//     res.status(404).send("😵 Can't find what you're looking for!");
//   });

//   app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).send('☠️ Something Broke!');
//   });

//   let server = http.createServer(app);

//   server.listen(PORT, () => {
//     console.log(`🚀 Express blasting off on port ${PORT}`);
//   });
// };

module.exports = ExpressServer;
