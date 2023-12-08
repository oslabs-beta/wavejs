const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const _ = require('lodash');
const Logger = require('./logger');


ffmpeg.setFfmpegPath(ffmpegPath);

//TODO: Add support for MPEG-DASH specific output




const streamConfig = {
  endpoint: 'live',
  streamId: 'test',
  userId: 'testUser',
};

const videoAudioConfig = {
  videoBitrate: 1200,
  h264Preset: 'superfast',
  videoCodec: 'libx264',
  audioBitrate: '256k',
  audioCodec: 'aac',
  audioChannels: '2',
  hlsTimeDuration: '1',
  hlsListSize: '1',
  protocols: ['hls'],
};

const loggerIdent = '[transmux]'

class FFmpegServer {
  constructor(session, port) {
    this.AVConfig = _.cloneDeep(videoAudioConfig);
    this.streamConfig = _.cloneDeep(streamConfig);
    this.session = session;
    this.streams = {

    };
    this.command = null;
    this.port = port;
    this.dash = false;
    this.hls = false;
  }
  configureStream(updatedConfig) {
    for (let key in updatedConfig) {
      this.streamConfig[key] = updatedConfig[key];
    }
  }
  configureAV(updatedConfig) {
    for (let key in updatedConfig) {
      this.AVConfig[key] = String(updatedConfig[key]);
    }
  }
  listen() {
    Logger.info(
      `🎥 Wave.js transmuxer starting at rtmp://127.0.0.1:${this.port}`
      //`🎥 FFmpeg Server starting at rtmp://localhost/${this.streamConfig.endpoint}/${this.streamConfig.streamId}`
    );
    this.session.initOutputStream(
      this.streamConfig.streamId,
      this.streamConfig.userId
    );
    this.initCommand();
    if (this.AVConfig.protocols.includes('hls')) this.addHLS();
    if (this.AVConfig.protocols.includes('dash')) this.addMPD();
    this.addEventListeners()
    this.stream.run()
  }

  close() {
      setTimeout(() => {
        this.streams.kill();
      }, 10 * 1000);
  }

  initCommand() {
    this.stream = ffmpeg()
      .input(`rtmp://127.0.0.1:${this.port}`, { timeout: 42300 })
      .inputOptions([
        '-rtmp_app', `${this.streamConfig.endpoint}/${this.streamConfig.streamId}`,
        '-listen', 1
      ])
  }

  addOutputFormatting() {
    if (this.stream) {
      this.stream
      .videoBitrate(this.AVConfig.videoBitrate)
      // set h264 preset
      .addOption('-preset', this.AVConfig.h264Preset)
      // set target codec (this encodes to H.264)
      .videoCodec(this.AVConfig.videoCodec)
      // set audio bitrate
      .audioBitrate(this.AVConfig.audioBitrate)
      // set audio codec
      .audioCodec(this.AVConfig.audioCodec)
      // set number of audio channels
      .audioChannels(this.AVConfig.audioChannels)
    } else {
      Logger.error(`${loggerIdent} stream has not been initialized.`)
    }
  }
  addHLS() {
    if (this.stream){
      this.hls = true;
      this.session.addOutputStream(this.streamConfig.streamId, 'hls');
      let HLSOutput = this.session.getOutputStreamPath(
        this.streamConfig.streamId, 'hls');
      this.stream.output(`${HLSOutput}/manifest.m3u8`)
        .addOutputOptions([
          '-hls_time', String(this.AVConfig.hlsTimeDuration),
          '-hls_list_size', String(this.AVConfig.hlsListSize)
        ])
      this.addOutputFormatting();
    } else {
      Logger.error(`${loggerIdent} stream has not been initialized.`)
    }
  }
  addMPD() {
    if (this.stream){
      this.dash = true;
      this.session.addOutputStream(this.streamConfig.streamId, 'dash');
      let dashOutput = this.session.getOutputStreamPath(
        this.streamConfig.streamId, 'dash');
      this.stream.output(`${dashOutput}/manifest.mpd`)
        .addOutputOptions([
          '-seg_duration', '8',
          '-frag_duration', '1',
          '-ldash', '1',
          '-streaming', '1',
          '-init_seg_name', 'init_$RepresentationID$.m4s',
          '-media_seg_name', 'chunk_$RepresentationID$_$Number%05d$.m4s',
          '-f dash',
        ]);
      this.addOutputFormatting();
    } else {
      Logger.error(`${loggerIdent} stream has not been initialized.`)
    }
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
