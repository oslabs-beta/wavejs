const OutputServer = require('./OutputServer');
const FFMpegServer = require('./FFmpegServer');
const session = require('./session');
const { Server } = require('./rtmp-server');
//const { Server:RTMPServer } = require('./rtmp-server')

class WaveJS {
  constructor() {
    this.session = session;
    this.outputServer = new OutputServer(this.session);
    this.ffmpegServer = new FFMpegServer(this.session);
    this.rtmpServer = Server();
    //this.rtmpServer = new RTMPServer()
  }
  configureAV(updatedSettings) {
    this.ffmpegServer.configureAV(updatedSettings);
  }
  setInput(updatedSettings) {
    this.ffmpegServer.configureStream(updatedSettings);
  }
  setOutput(updatedSettings) {
    this.outputServer.configureOutput(updatedSettings);
  }
  listen() {
    this.rtmpServer.run();
    //this.ffmpegServer.listen();
    this.outputServer.listen();
  }
  close() {
    this.ffmpegServer.close();
    this.outputServer.close();
  }
}

module.exports = WaveJS;
