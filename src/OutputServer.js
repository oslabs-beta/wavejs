const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const cors = require('cors');

const utils = require('./utils')
const Logger = require('./logger');
const outputMiddleware = require('./outputMiddleware');


const loggerIdent = '[stream output]';

class OutputServer {
  constructor(session) {
    this.config = {
      port: 3000,
      endpoint: 'wavejs',
    };
    this.app = express();
    this.session = session;
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
        `🚀 Wave.js output server launching at http://localhost:${this.config.port}/${this.config.endpoint}`
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
    this.app.all('*', (req, res) => {
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
    const getParams = utils.partialMod(
      outputMiddleware.getParams, 
      [loggerIdent]
      );
    const getStream = utils.partialMod(
      outputMiddleware.getStream, 
      [loggerIdent, this.session]
      );
    this.app.get(`/${this.config.endpoint}/:streamKey/:extension`,
      getParams,
      getStream,
      (req, res) => {
        res.status(200).set('Content-Type', res.locals.contentType);
        fs.createReadStream(res.locals.videoPath).pipe(res);
      }
    );
  }

  debug() {
    this.app.get('/streams', (req, res) => {
      res.status(200).json(Object.fromEntries(this.session.streams));
    });
  }
}
module.exports = OutputServer;
