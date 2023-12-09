const OutputServer = require('./OutputServer');
const FFMpegServer = require('./FFmpegServer');
const session = require('./session');
const { RTMPGateway } = require('./rtmp-server');
//const { Server:RTMPServer } = require('./rtmp-server')

class WaveJS {
  constructor() {
    this.session = session;
    this.outputServer = new OutputServer(this.session);
    this.ffmpegServer = new FFMpegServer(this.session);
    this.rtmpGateway = new RTMPGateway(this.session);
    //this.rtmpServer = new RTMPServer()
  }
  configureAV(updatedSettings) {
    this.ffmpegServer.configureAV(updatedSettings);
    this.rtmpGateway.setTransmuxServer(this.ffmpegServer);
  }
  setInput(updatedSettings) {
    this.ffmpegServer.configureStream(updatedSettings);
    this.rtmpGateway.setTransmuxServer(this.ffmpegServer);
  }
  setOutput(updatedSettings) {
    this.outputServer.configureOutput(updatedSettings);
  }
  
  listen() {
    this.rtmpGateway.listen();
    //this.ffmpegServer.listen();
    this.outputServer.listen();
  }
  close() {
    this.ffmpegServer.close();
    this.outputServer.close();
  }
}

module.exports = WaveJS;
