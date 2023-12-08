const Logger = require('./logger');
const fs = require('node:fs');

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

const outputMiddleware = {
  getParams(loggerIdent, req, res, next) {
    try {
      const endpoint = req.path.slice(1).split('/', 1)[0]
      const streamKey = req.params.streamKey;
      const fullExtension = req.params.extension;
      const ext = fullExtension.split('.')[1];
      if (endpoint && streamKey && fullExtension) {
        Logger.debug(
          `${loggerIdent} endpoint: ${endpoint}/${streamKey}/${fullExtension}`
          );
          res.locals = {
            ...res.locals,
            endpoint,
            streamKey,
            fullExtension,
            ext
          }
          return next();
      } else {
        return next({
          log: 'outputMiddleware.getParams: a parameter is undefined, '+
          `endpoint=${endpoint}, streamKey=${streamKey}, fullExtension=${fullExtension}, ext=${ext}`,
          code: 400,
          message: {err: 'Bad request'}
        });
      }
    
    } catch(err) {
      return next({
        log: `outputMiddleware.getParams: ${err}`,
        code: 400,
        message: {err: 'Bad request'}
      });
    }
  },

  getStream(loggerIdent, session, req, res, next) {
    const streamId = session.activeLiveStreams.get(res.locals.streamKey);
    let videoPath, streamPath, contentType;
    console.log('getStream')
    if (Object.keys(extProtocol).includes(res.locals.ext)) {
      try {
        streamPath = session.getOutputStreamPath(
          streamId,
          extProtocol[res.locals.ext]
        );
        contentType = contentTypes[res.locals.ext];
        videoPath = `${streamPath}/${res.locals.fullExtension}`;
      } catch (err) {
        return next({
          log: `outputMiddleware.getStream: ${err.message}`,
          code: 500,
          message: { err: err.message }
        });
      }
      Logger.debug(`${loggerIdent} videoPath: ${videoPath}`);
      if (fs.existsSync(videoPath)) {
        res.locals.contentType = contentType;
        res.locals.videoPath = videoPath;
        return next();

      } else {
        return next({
          log:`outputMiddleware.getStream: stream at ${req.path} isn't ready`,
          code: 404,
          message: {err: 'Not found'}
        }); 
      }
    } else {
      return next({
        log:`outputMiddleware.getStream: provided 'ext' of ${res.locals.ext} not supported`,
        code: 400,
        message: {err: 'Bad request'}
      })
    }
  }


};

//outputMiddleware.test();
module.exports = outputMiddleware;