const expressServer = require('./expressServer');
const ffmpegServer = require('./ingest')
const session = require('./session')



//start express server
expressServer(session);
//start ffmpeg server
ffmpegServer(session);

