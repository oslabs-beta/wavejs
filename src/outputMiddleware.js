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
      const streamId = req.params.streamId;
      if (endpoint && streamKey && fullExtension) {
        Logger.debug(
          `${loggerIdent} endpoint: ${endpoint}/${streamKey}/${fullExtension}`
          );
          res.locals = {
            ...res.locals,
            endpoint,
            streamKey,
            fullExtension,
            ext,
            streamId
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

  getLiveStream(loggerIdent, session, req, res, next) {
    const streamId = session.activeLiveStreams.get(res.locals.streamKey);
    Logger.debug(`[onetime] session`, session)
    Logger.debug(`[onetime] getStream - streamId ${streamId}`)
    let videoPath, streamPath, contentType;
    if (Object.keys(extProtocol).includes(res.locals.ext)) {
      try {
        streamPath = session.getOutputStreamPath(
          streamId,
          extProtocol[res.locals.ext]
        );
        Logger.debug(`[onetime] getStream - streamPath ${streamPath}`)
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
          log:`outputMiddleware.getStream: stream at ${req.path} isn't available`,
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
  },
  getPlaybackStream(loggerIdent, session, req, res, next) {
    let videoPath, streamPath, contentType;
    if (Object.keys(extProtocol).includes(res.locals.ext)) {
      try {
        streamPath = session.getOutputStreamPath(
          res.locals.streamId,
          extProtocol[res.locals.ext]
        );
        Logger.debug(`[onetime] getStream - streamPath ${streamPath}`)
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
          log:`outputMiddleware.getStream: stream at ${req.path} isn't available`,
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