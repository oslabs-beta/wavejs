const Logger = require('./logger');


const outputMiddleware = {};

outputMiddleware.contentTypes = {
  '.flv': 'video/x-flv',
  '.mp4': 'video/mp4',
  m3u8: 'application/x-mpegURL',
  ts: 'application/x-mpegURL',
  mpd: 'application/dash+xml',
  m4s: 'application/dash+xml',
};

outputMiddleware.extProtocol = {
  m3u8: 'hls',
  ts: 'hls',
  mpd: 'dash',
  m4s: 'dash',
};

outputMiddleware.getParams = (loggerIdent, req, res, next) => {
  try {
    const endpoint = req.path.slice(1).split('/', 1)[0]
    const streamKey = req.params.streamKey;
    const fullExtension = req.params.extension;
    const ext = fullExtension.split('.')[1];
  } catch(err) {
    Logger.error(`${loggerIdent} ${err.message}`)
    next()
  }
  

  Logger.debug(
    `${loggerIdent}endpoint: ${this.config.endpoint}/${req.params.streamKey}/${req.params.extension}`
    );
  
}


module.exports = outputMiddleware;