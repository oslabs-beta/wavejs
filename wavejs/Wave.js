const ExpressServer = require('./ExpressServer');
const FFMpegServer = require('./FFmpegServer')
const session = require('./session')

const { Server:RTMPServer } = require('./rtmp-server')


class WaveJS {
  constructor() {
    this.expressServer = new ExpressServer();
    this.ffmpegServer = new FFMpegServer();
    //this.rtmpServer = new RTMPServer()
    this.session = session;
  }
  configureAV(updatedSettings) {
    this.ffmpegServer.configureAV(updatedSettings);
  }
  setInput (updatedSettings) {
    this.ffmpegServer.configureStream(updatedSettings);
  }
  setOutput(updatedSettings) {
    this.expressServer.configureOutput(updatedSettings);
  }
  listen() {
    this.ffmpegServer.listen();
    this.expressServer.listen();
  }
  close() {
    this.ffmpegServer.close();
    this.expressServer.close();
  }

}

module.exports = WaveJS