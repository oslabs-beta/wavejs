const expressServer = require('./expressServer');
const ffmpegServer = require('./ingest')
const session = require('./session')

const STREAM_ID = 'test';
const RTMP_ENDPOINT = 'live'
const HTTP_ENDPOINT = 'video'

//start express server
expressServer(session, HTTP_ENDPOINT);
//start ffmpeg server
ffmpegServer(session, STREAM_ID, RTMP_ENDPOINT);

