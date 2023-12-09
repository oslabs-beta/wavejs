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
  updateAVSettings(updatedSettings) {
    this.ffmpegServer.updateAVSettings(updatedSettings);
    this.rtmpGateway.setTransmuxServer(this.ffmpegServer);
  }
  updateOutputProtocol(...args) {
    this.ffmpegServer.setOutputProtocols(...args);
  }
  updateHLSOutput(updatedSettings) {
    if (!this.ffmpegServer.protocols.includes('hls')) {
      this.ffmpegServer.setOutputProtocols(
        ...this.ffmpegServer.protocols,
        'hls'
      )
    }
    this.ffmpegServer.updateProtocolSettings('hls', updatedSettings)
  }
  updateMPDOutput(updatedSettings) {
    if (!this.ffmpegServer.protocols.includes('dash')) {
      this.ffmpegServer.setOutputProtocols(
        ...this.ffmpegServer.protocols,
        'dash'
      )
    }
    this.ffmpegServer.updateProtocolSettings('dash', updatedSettings)
  }
  updateInputSettings(updatedSettings) {
    this.ffmpegServer.updateStreamSettings(updatedSettings);
    this.rtmpGateway.setTransmuxServer(this.ffmpegServer);
  }
  updateOutputSettings(updatedSettings) {
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
