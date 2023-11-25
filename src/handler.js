const expressServer = require('./expressServer');
const { ffmpegServer } = require('./ingest');
const session = require('./session');

const STREAM_ID = 'test';
const RTMP_ENDPOINT = 'live';
const HTTP_ENDPOINT = 'video';

// start ffmpeg server:
const startFfmpegServer = () => {
  ffmpegServer.start();
};

// configure ffmpeg stream:
const configureStream = (updatedSettings) => {
  ffmpegServer.configureStream(updatedSettings);
};

// configure ffmpeg video and audio settings:
const configureVideoAudio = (updatedSettings) => {
  ffmpegServer.configureVideoAudio(updatedSettings);
};

// start express server:
const startExpressServer = (session, HTTP_ENDPOINT) => {
  expressServer.createExpressApp(session, HTTP_ENDPOINT);
};

// start express & ffmpeg servers:
const startServers = (session, HTTP_ENDPOINT) => {
  startFfmpegServer();
  startExpressServer(session, HTTP_ENDPOINT);
};

startServers();

// //start express server
// expressServer(session, HTTP_ENDPOINT);
// //start ffmpeg server
// ffmpegServer(session, STREAM_ID, RTMP_ENDPOINT);
