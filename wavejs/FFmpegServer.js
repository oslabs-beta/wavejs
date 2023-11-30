const ffmpeg = require('fluent-ffmpeg');
const _ = require('lodash');
const { buildHLSPlaylistPath, buildHLSDir } = require('./FileController');
const session = require('./session');

const streamConfig = {
  session,
  endpoint: 'live',
  streamId: 'test',
};

const videoAudioConfig = {
  videoBitrate: 1200,
  h264Preset: ['-preset', 'superfast'],
  videoCodec: 'libx264',
  audioBitrate: '256k',
  audioCodec: 'aac',
  audioChannels: 2,
  hlsTimeDuration: ['-hls_time', '1'],
  hlsListSize: ['-hls_list_size', '1'],
};

class FFmpegServer {
  constructor() {
    this.AVConfig = _.cloneDeep(videoAudioConfig);
    this.streamConfig = _.cloneDeep(streamConfig);
    this.session = session;
  }
  configureStream(updatedConfig) {
    for (let key in updatedConfig) {
      this.streamConfig[key] = updatedConfig[key];
    }
  }
  configureAV(updatedConfig) {
    for (let key in updatedConfig) {
      this.AVConfig[key] = updatedConfig[key];
    }
  }
  listen() {
    console.log(
      `🎥 FFmpeg Server starting at rtmp://localhost/${this.streamConfig.endpoint}/${this.streamConfig.streamId}`
    );
    buildHLSDir(this.streamConfig.streamId);
    this.stream = this.buildStream(
      this.streamConfig.streamId,
      this.streamConfig.endpoint,
      this.streamConfig.session
    );
    this.session.initOutputStream(this.streamConfig.streamId);
    this.session.addOutputStream(this.streamConfig.streamId, 'hls');
    this.stream.run();
  }
  close() {
    if (this.stream) {
      setTimeout(() => {
        this.stream.kill();
      }, 10 * 1000);
    }
  }
  buildStream() {
    const stream = ffmpeg(
      `rtmp://localhost/${this.streamConfig.endpoint}/${this.streamConfig.streamId}`,
      {
        timeout: 432000,
      }
    )
      // set video bitrate
      .videoBitrate(this.AVConfig.videoBitrate)
      // set h264 preset
      .addOption(this.AVConfig.h264Preset[0], this.AVConfig.h264Preset[1])
      // set target codec (this encodes to H.264)
      .videoCodec(this.AVConfig.videoCodec)
      // set audio bitrate
      .audioBitrate(this.AVConfig.audioBitrate)
      // set audio codec
      .audioCodec(this.AVConfig.audioCodec)
      // set number of audio channels
      .audioChannels(this.AVConfig.audioChannels)
      // set hls segments time (chunks are approximately 8 seconds long each)
      .addOption(
        `${this.AVConfig.hlsTimeDuration[0]} ${this.AVConfig.hlsTimeDuration[1]}`
      )
      // include all the segments in the list (don't remove old segments => for saving / on-demand playback)
      .addOption(
        `${this.AVConfig.hlsListSize[0]} ${this.AVConfig.hlsListSize[1]}`
      )
      .output(buildHLSPlaylistPath(this.streamConfig.streamId))
      .inputOptions('-listen 1')
      // .on('start', (commandLine) => {
      //   console.log('Spawned Ffmpeg with command: ' + commandLine);
      // })
      .on('codecData', function (data) {
        console.log(
          'Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video'
        );
      })
      .on('progress', function (progress) {
        console.log('Processing: ' + JSON.stringify(progress));
      })
      // event handler for end of stream
      .on('end', function () {
        console.log('Success! Your live stream has been saved.');
        session.setActive(this.streamConfig.streamId, false);
        process.exit(0);
      })
      // error handling
      .on('error', function (err) {
        console.log('An error occurred: ' + err.message);
        session.setActive(this.streamConfig.streamId, false);
        process.exit(0);
      })
      // .on('stderr', function (stderrLine) {
      //   console.log('Stderr output: ' + stderrLine);
      // })
      .on('connection', () => {
        console.log('Someone Connected!');
        session.setActive(this.streamConfig.streamId, true);
      });
    return stream;
  }
}

module.exports = FFmpegServer;

// const buildStream = (streamId, endpoint, session) => {
//   //const stream = ffmpeg(`rtmp://localhost/live`, { timeout: 432000 })
//   const stream = ffmpeg(`rtmp://localhost/${endpoint}/${streamId}`, {
//     timeout: 432000,
//   })
//     // set video bitrate
//     .videoBitrate(1200)
//     // set h264 preset
//     .addOption('-preset', 'superfast')
//     // set target codec (this encodes to H.264)
//     .videoCodec('libx264')
//     // set audio bitrate
//     .audioBitrate('256k')
//     // set audio codec
//     .audioCodec('aac')
//     // set number of audio channels
//     .audioChannels(2)
//     // set hls segments time (chunks are approximately 8 seconds long each)
//     .addOption('-hls_time 8')
//     // include all the segments in the list (don't remove old segments => for saving / on-demand playback)
//     .addOption('-hls_list_size 0')
//     //.addOption('-hls_playlist_type', 'event')

//     .output(buildHLSPlaylistPath(streamId))

//     .inputOptions('-listen 1')

//     .on('start', (commandLine) => {
//       console.log('Spawned Ffmpeg with command: ' + commandLine);
//     })
//     .on('codecData', function (data) {
//       console.log(
//         'Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video'
//       );
//     })
//     .on('progress', function (progress) {
//       console.log('Processing: ' + JSON.stringify(progress));
//     })
//     // event handler for end of stream
//     .on('end', function () {
//       console.log('Success! Your live stream has been saved.');
//       session.setActive(streamId, false);
//       process.exit(0);
//     })
//     // error handling
//     .on('error', function (err) {
//       console.log('An error occurred: ' + err.message);
//       session.setActive(streamId, false);
//       process.exit(0);
//     })
//     .on('stderr', function (stderrLine) {
//       console.log('Stderr output: ' + stderrLine);
//     })
//     .on('connection', () => {
//       console.log('Someone Connected!');
//       session.setActive(streamId, true);
//     });
//   return stream;
// };

// // The listen command makes FFmpeg act as an RTMP server
// //stream._currentInput.options('-listen', 1);

// // Saves the file locally
// //stream.save('../videoFiles/test.m3u8');

// const ffmpegServer = (session, streamId, endpoint) => {
//   console.log(
//     `🎥 FFmpeg Server starting at rtmp://localhost/${endpoint}/${streamId}`
//   );
//   buildHLSDir(streamId);
//   const stream = buildStream(streamId, endpoint, session);
//   session.addStream(streamId);
//   stream.run();
// };
// module.exports = ffmpegServer;
