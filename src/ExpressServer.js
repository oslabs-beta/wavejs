const express = require('express');
const http = require('node:http');
const fs = require('node:fs');

const cors = require('cors');
const Logger = require('./logger');
const outputMiddleware = require('./output-middleware');

const contentTypes = {
  '.flv': 'video/x-flv',
  '.mp4': 'video/mp4',
  m3u8: 'application/x-mpegURL',
  ts: 'application/x-mpegURL',
  mpd: 'application/dash+xml',
  m4s: 'application/dash+xml',

};

const extProtocol = {
  m3u8: 'hls',
  ts: 'hls',
  mpd: 'dash',
  m4s: 'dash',
}



const loggerIdent = '[stream output]';

class ExpressServer {
  constructor(session) {
    this.config = {
      port: 3000,
      endpoint: 'wavejs',
    };
    this.app = express();
    this.session = session;
    this.defaultErr = defaultError
    this.app.disable('x-powered-by');
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    this.app.use(Logger.expressHttpLogger);
    this.app.use(cors());

  }
  listen(port = this.config.port) {
    if (port) this.configureOutput({ port: port });
    this.registerRoutes();
    this.server = http.createServer(this.app);
    this.server.listen(this.config.port, () => {
      Logger.info(
        `🚀 Express blasting off at http://localhost:${this.config.port}/${this.config.endpoint}`
      );
    });
  }
  close() {
    this.server.close();
  }
  configureOutput({ port, endpoint }) {
    if (typeof port === 'number' && String(port).length === 4)
      this.config.port = port;
    if (typeof endpoint === 'string' && endpoint.length > 2)
      this.config.endpoint = endpoint;
  }
  registerRoutes() {
    this.dynamicRoute();
    this.app.all('*', (req, res, next) => {
      Logger.error(`404: ${req.baseUrl}`);
      res.status(404).send("😵 Can't find what you're looking for!");
    });
    this.app.use((err, req, res, next) => {
      const defaultError = {
        code: 500,
        log: 'Error handler caught unknown middleware error',
        message: { err: 'An error occured'}
      }
      const errorObj = Object.assign({}, defaultError, err);
      Logger.error(`${loggerIdent} ${errorObj.log}`)
      res.status(errorObj.code).send(errorObj.message);
    });
  }

  dynamicRoute() {
    this.app.get(
      `/${this.config.endpoint}/:streamKey/:extension`,
      //`/${this.config.endpoint}/:streamId/:extension`,
      (req, res) => {
        Logger.debug(req.path, req.baseUrl, req.originalUrl)
        Logger.debug(req.route)
        //this is the area where we need to connect fmpg to the server
        Logger.debug(
          `${loggerIdent}endpoint: ${this.config.endpoint}/${req.params.streamKey}/${req.params.extension}`
          //`endpoint: ${this.config.endpoint}/${req.params.streamId}/${req.params.extension}`
        );
        const ext = req.params.extension.split('.')[1];
        let videoPath, streamPath;
        let contentType;
        const streamId = this.session.activeLiveStreams.get(
          req.params.streamKey
        );
        // Logger.debug('stream: ', this.session.outputStreams)

        if (Object.keys(extProtocol).includes(ext)) {
          try {
            streamPath = this.session.getOutputStreamPath(
              streamId,
              //req.params.streamId,
              extProtocol[ext]
            );
            contentType = contentTypes[ext];
            videoPath = `${streamPath}/${req.params.extension}`;
          } catch (err) {
            Logger.error(`${loggerIdent}: ${err.message}`)
            res.status(404).send('Not Found');
          }
          Logger.debug(`videoPath: ${videoPath}`);
        if (fs.existsSync(videoPath)) {
          res.status(200).set('Content-Type', contentType);
          fs.createReadStream(videoPath).pipe(res);
        } else {
          Logger.error("Stream isn't ready");
          res.status(400).send("Stream isn't ready");
        }

        } else {
          Logger.error(`Requested extension not supported: ${ext}`);
          res.status(400).send('Bad Request');
        }
      }
    );
  }

  debug() {
    this.app.get('/streams', (req, res) => {
      res.status(200).json(Object.fromEntries(this.session.streams));
    });
  }
}
module.exports = ExpressServer;
