const ffmpeg = require('fluent-ffmpeg');
const _ = require('lodash');
const FileController = require('./FileController');
const streamStorage = require('./session');

//TODO: Add support for MPEG-DASH specific output

const streamConfig = {
  endpoint: 'live',
  streamId: 'test',
  userId: 'testUser',
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
  protocols: ['hls'],
};

class FFmpegServer {
  constructor(session, port) {
    this.AVConfig = _.cloneDeep(videoAudioConfig);
    this.streamConfig = _.cloneDeep(streamConfig);
    this.session = session;
    this.streams = {};
    this.port = port;
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
      `🎥 FFmpeg Server starting at rtmp://127.0.0.1:${this.port}`
      //`🎥 FFmpeg Server starting at rtmp://localhost/${this.streamConfig.endpoint}/${this.streamConfig.streamId}`
    );
    this.session.initOutputStream(
      this.streamConfig.streamId,
      this.streamConfig.userId
    );
    if (this.AVConfig.protocols.includes('hls')) {
      this.session.addOutputStream(this.streamConfig.streamId, 'hls');
      let HLSOutput = this.session.getOutputStreamPath(
        this.streamConfig.streamId,
        'hls'
      );
      this.streams.hls = this.buildHLSStream(HLSOutput);
      this.streams.hls.run();
    }
    if (this.AVConfig.protocols.includes('dash')) {
      this.session.addOutputStream(this.streamConfig.streamId, 'dash');
      let dashOutput = this.session.getOutputStreamPath(
        this.streamConfig.streamId,
        'dash'
      );
      this.streams.dash = this.buildMPDStream(dashOutput);
      this.streams.dash.run();
    }
  }
  close() {
    if (this.streams.hls) {
      setTimeout(() => {
        this.streams.hls.kill();
      }, 10 * 1000);
    }
    if (this.streams.dash) {
      setTimeout(() => {
        this.streams.dash.kill();
      }, 10 * 1000);
    }
  }
  buildMPDStream(outputPath) {
    const fullOutput = `${outputPath}/manifest.mpd`;
    const stream = ffmpeg()
      .input(`rtmp://127.0.0.1:${this.port}`, { timeout: 42300 })

      .inputOption(
        '-rtmp_app',
        `${this.streamConfig.endpoint}/${this.streamConfig.streamId}`
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
      .addOutputOptions([
        '-seg_duration',
        '8',
        '-frag_duration',
        '1',
        '-ldash',
        '1',
        '-streaming',
        '1',
        '-init_seg_name init_$RepresentationID$.m4s',
        '-media_seg_name chunk_$RepresentationID$_$Number%05d$.m4s',
        '-f dash',
      ])
      .output(fullOutput)
      .inputOptions('-listen 1')
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('codecData', function (data) {
        console.log(
          'Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video'
        );
      })
      .on('progress', (progress) => {
        console.log('Processing: ' + JSON.stringify(progress));
      })
      // event handler for end of stream
      .on('end', async () => {
        console.log('Success! Your live stream has been saved.');
        this.session.setOutputStreamActive(
          this.streamConfig.streamId,
          'dash',
          false
        );
        /*COMMENT LINES 141 to 145 in to delete files after stream has ended */
        // await this.session.deleteOutputStream(
        //   this.streamConfig.streamId,
        //   'dash'
        // );
        //process.exit(0);
      })
      // error handling
      .on('error', (err) => {
        console.log('An error occurred: ' + err.message);
        this.session.setOutputStreamActive(
          this.streamConfig.streamId,
          'dash',
          false
        );
        process.exit(0);
      })
      .on('stderr', function (stderrLine) {
        console.log('Stderr output: ' + stderrLine);
      })
      .on('connection', () => {
        console.log('Someone Connected!');

        this.session.setOutputStreamActive(
          this.streamConfig.streamId,
          'dash',
          true
        );
      });
    return stream;
  }
  buildHLSStream(outputPath) {
    const fullOutput = `${outputPath}/manifest.m3u8`;
    const stream = ffmpeg()
      .input(`rtmp://127.0.0.1:${this.port}`, { timeout: 42300 })

      .inputOption(
        '-rtmp_app',
        `${this.streamConfig.endpoint}/${this.streamConfig.streamId}`
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
      .output(fullOutput)
      .inputOptions('-listen 1')
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('codecData', function (data) {
        console.log(
          'Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video'
        );
      })
      // .on('progress', (progress) =>{
      //   console.log('Processing: ' + JSON.stringify(progress));

      // })
      // event handler for end of stream
      .on('end', async () => {
        console.log('Success! Your live stream has been saved.');
        this.session.setOutputStreamActive(
          this.streamConfig.streamId,
          'hls',
          false
        );
        /*COMMENT LINES 225 to 228 in to delete files after stream has ended */
        // await this.session.deleteOutputStream(
        //   this.streamConfig.streamId,
        //   'hls'
        // );
        //process.exit(0);
      })
      // error handling
      .on('error', (err) => {
        console.log('An error occurred: ' + err.message);
        this.session.setOutputStreamActive(
          this.streamConfig.streamId,
          'hls',
          false
        );
        process.exit(0);
      })
      // .on('stderr', function (stderrLine) {
      //   console.log('Stderr output: ' + stderrLine);
      // })
      .on('connection', () => {
        console.log('Someone Connected!');

        this.session.setOutputStreamActive(
          this.streamConfig.streamId,
          'hls',
          true
        );
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
