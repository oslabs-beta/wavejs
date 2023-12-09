const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const _ = require('lodash');
const Logger = require('./logger');
const { 
  config, 
  configValPipe,
  configMappedPipe, 
  configUnmappedPipe,
  configFilter,
 } = require('./ffmpegOptions');


ffmpeg.setFfmpegPath(ffmpegPath);


const loggerIdent = '[transmux]'

class FFmpegServer {
  constructor(session, port) {
    this.session = session;
    this.stream = null;
    this.port = port;


    this.avConfig = _.cloneDeep(config.av);
    this.streamConfig = _.cloneDeep(config.stream);
    this.globalConfig = _.cloneDeep(config.global);

    
    this.protocols = ['hls'];
    this.setOutputProtocols();
  }

  setOutputProtocols(...args) {
    const accepted = ['dash', 'hls'];
    if (args.length > 0) {
      this.protocols = args.filter(protocol => accepted.includes(protocol));
    }
    if (this.protocols.includes('hls')) {
      this.hlsConfig = _.cloneDeep(config.hls);
    }
    if (this.protocols.includes('dash')) {
      this.dashConfig = _.cloneDeep(config.dash);
    }
  }
  updateAVSettings(updatedConfig) {
    try {
      let newConfig = configFilter(updatedConfig);
      newConfig = configValPipe(newConfig);
      const acceptedKeys = Object.keys(config.av);
      const wrongKeys = [];
      Object.entries(newConfig).forEach(([key, val]) => {
        if (acceptedKeys.includes(key)) this.avConfig[key] = val;
        else {wrongKeys.push(key)}
      });
      if (wrongKeys.length > 0) Logger.error(`${loggerIdent} some incorrect av config keys provided; wave.js is ignoring them: ${wrongKeys.join(', ')}`);
    } catch(err) {
      Logger.error(`${loggerIdent} ${err.message}`)
    }
  }
  updateGlobalSettings(updatedConfig) {
    try {
      let newConfig = configFilter(updatedConfig);
      newConfig = configValPipe(newConfig);
      const acceptedKeys = Object.keys(config.global);
      const wrongKeys = [];
      Object.entries(newConfig).forEach(([key, val]) => {
        if (acceptedKeys.includes(key)) this.globalConfig[key] = val;
        else {wrongKeys.push(key)}
      });
      if (wrongKeys.length > 0) Logger.error(`${loggerIdent} some incorrect global config keys provided; wave.js is ignoring them: ${wrongKeys.join(', ')}`);      
    } catch(err) {
      Logger.error(`${loggerIdent} ${err.message}`)
    }
  }
  updateStreamSettings(updatedConfig) {
    try {
      let newConfig = configFilter(updatedConfig);
      newConfig = configValPipe(newConfig);
      const acceptedKeys = Object.keys(config.stream);
      const wrongKeys = [];
      Object.entries(newConfig).forEach(([key, val]) => {
        if (acceptedKeys.includes(key)) this.streamConfig[key] = val;
        else {wrongKeys.push(key)}
      });
      if (wrongKeys.length > 0) Logger.error(`${loggerIdent} some incorrect stream config keys provided; wave.js is ignoring them: ${wrongKeys.join(', ')}`);
    } catch(err) {
      Logger.error(`${loggerIdent} ${err.message}`)
    }
  }
  updateProtocolSettings(protocol, updatedConfig) {
    try {
      let newConfig = configFilter(updatedConfig);
      newConfig = configValPipe(newConfig);
      let hlsWrongKeys = [];
      let dashWrongKeys = [];
      Object.entries(newConfig).forEach(([key, val]) => {
        if (protocol === 'hls') {

          const hlsAcceptedKeys = Object.keys(config.hls);
          if (hlsAcceptedKeys.includes(key)) this.hlsConfig[key] = val;
          else {hlsWrongKeys.push(key)}
        }
        if (protocol === 'dash') {
          const dashAcceptedKeys = Object.keys(config.dash);
          if (dashAcceptedKeys.includes(key)) this.dashConfig[key] = val;
          else {dashWrongKeys.push(key)}
        }
      });
      if (hlsWrongKeys.length > 0) Logger.error(`${loggerIdent} some incorrect hls config keys provided; wave.js is ignoring them: ${hlsWrongKeys.join(', ')}`);
      if (dashWrongKeys.length > 0) Logger.error(`${loggerIdent} some incorrect dash config keys provided; wave.js is ignoring them: ${dashWrongKeys.join(', ')}`);

    } catch(err) {
      Logger.error(`${loggerIdent} ${err.message}`)
      throw err
    }
  }
  
  initStream() {
    this.stream = ffmpeg()
      .input(`rtmp://127.0.0.1:${this.port}`, { timeout: 42300 })
      .inputOptions([
        '-rtmp_app', `${this.streamConfig.endpoint}/${this.streamConfig.streamId}`,
        '-listen', 1
      ])
  }
  addOutputFormatting() {
    if (this.stream) {
      let outputOptions = configMappedPipe(this.avConfig);
      this.stream.addOptions(outputOptions);
    } else {
      Logger.error(`${loggerIdent} stream has not been initialized.`)
    }
  }
  addHLS() {
    if (this.stream){
      this.session.addOutputStream(this.streamConfig.streamId, 'hls');
      let HLSOutput = this.session.getOutputStreamPath(
        this.streamConfig.streamId, 'hls'
        );
      let outputOptions = configUnmappedPipe(this.hlsConfig);
      this.stream.output(`${HLSOutput}/manifest.m3u8`)
        .addOutputOptions(outputOptions)
      this.addOutputFormatting();
    } else {
      Logger.error(`${loggerIdent} stream has not been initialized.`)
    }
  }
  addMPD() {
    if (this.stream){
      this.session.addOutputStream(this.streamConfig.streamId, 'hls');
      let dashOutput = this.session.getOutputStreamPath(
        this.streamConfig.streamId, 'dash');
      let outputOptions = configUnmappedPipe(this.dashConfig);
      this.stream.output(`${dashOutput}/manifest.mpd`)
        .addOutputOptions(outputOptions)
      this.addOutputFormatting();
    } else {
      Logger.error(`${loggerIdent} stream has not been initialized.`)
    }
  }
  setMediaDirectory(path) {
    this.mediaRoot = path;
    console.log('ffmpeg server, media root set', this.mediaRoot)
  }
  listen() {
    Logger.info(
      `🎥 Wave.js transmuxer starting at rtmp://127.0.0.1:${this.port}`
      //`🎥 FFmpeg Server starting at rtmp://localhost/${this.streamConfig.endpoint}/${this.streamConfig.streamId}`
    );
    try {
      let mediaRoot = typeof this.mediaRoot === 'undefined' ? undefined : this.mediaRoot;
      console.log('mediaRoot: ', mediaRoot)
      this.session.initOutputStream(
        this.streamConfig.streamId,
        this.streamConfig.userId,
        mediaRoot
      );
      this.initStream();
      if (this.protocols.includes('hls')) this.addHLS();
      if (this.protocols.includes('dash')) this.addMPD();
      this.addEventListeners()
      this.stream.run()
    } catch(err) {
      Logger.error(`${loggerIdent} ${err.message}`);
      throw err;
    }
    
  }

  close() {
      setTimeout(() => {
        this.stream.kill();
      }, 10 * 1000);
  }

  addEventListeners() {
      this.stream
      .on('start', (commandLine) => {
        Logger.debug(`${loggerIdent} spawned Ffmpeg with command: ${commandLine}`);
      })

      .on('codecData', function (data) {
          Logger.debug(
            `${loggerIdent} Input is ${data.audio} audio with ${data.video}video`);})
            
      // this breaks the socket for some reason, don't enable
      // .on('progress', function (progress) {
      //   console.log('Processing: ' + JSON.stringify(progress));
      // })
      // event handler for end of stream
      .on('end', async () => {
          Logger.debug(`${loggerIdent} stream ended.`);
          this.session.setOutputStreamActive(
            this.streamConfig.streamId, 'dash', false);
          this.dash = false;
          //*Uncomment to delete files after stream has ended */
          // await this.session.deleteOutputStream(
          //   this.streamConfig.streamId,
          //   'dash'
          // );
            this.session.setOutputStreamActive(
              this.streamConfig.streamId, 'hls', false);
          this.hls = false;
          //*Uncomment to delete files after stream has ended */
          // await this.session.deleteOutputStream(
          //   this.streamConfig.streamId,
          //   'hls'
          // );
          }
          //process.exit(0);
        )
      // error handling
      .on('error', (err) => {
         Logger.error(`${loggerIdent} An error occurred: ${err.message}`);
          this.session.setOutputStreamActive(
            this.streamConfig.streamId,
            'dash',
            false
          );
          this.session.setOutputStreamActive(
            this.streamConfig.streamId,
            'hls',
            false
          );
          this.dash = false;
          this.hls = false;
          process.exit(0);
        })
        .on('stderr', function (stderrLine) {
          if (stderrLine.includes('frame=')) {
            const results = readStdErr(stderrLine);
            Logger.info(`${loggerIdent} progress: frame ${results.frame} processed, total duration ${results.time} `)
          }
          //Logger.debug(`${loggerIdent} stderr output: ${stderrLine}`);
        })
        .on('connection', () => {
            Logger.info(`${loggerIdent} connection established`);
            if (this.hls) {
              this.session.setOutputStreamActive(
              this.streamConfig.streamId,
              'hls',
              true);
            }
            if (this.dash) {
              this.session.setOutputStreamActive(
                this.streamConfig.streamId,
                'dash',
                true);
            }
          });
  }
  clone () {
    const clone = new FFmpegServer()
    clone.session = this.session;
    clone.stream = this.stream;
    clone.port = this.port;
    clone.avConfig = this.avConfig;
    clone.streamConfig = this.streamConfig;
    clone.globalConfig = this.globalConfig;
    clone.protocols = this.protocols;
    if (this.mediaRoot){
      clone.mediaRoot = this.mediaRoot;
    }
    if (this.hlsConfig) {
      clone.hlsConfig = this.hlsConfig;
    }
    if (this.mpdConfig) {
      clone.mpdConfig = this.mpdConfig;
    }
    return clone;
  }

}

const readStdErr = (stdErrLine) => {
  const results = [...stdErrLine.match(/[a-z]*=[ ]*[a-zA-Z0-9:\./]*/g)]
  let output = results.reduce((acc, entry) => {
    let [k, v] = entry.split('=')
    acc[k.trim()] = v.trim();
    return acc;
  }, {});
  return output;
}

module.exports = FFmpegServer;
