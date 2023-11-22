// Require the ffmpeg library:
const ffmpeg = require('fluent-ffmpeg');
//const logger = require('./logger')
const net = require('node:net');
const { buildHLSPlaylistPath, buildHLSDir } = require('./fileController');
const session = require('./session');
// console.log(path.join(__dirname,'../VideoFiles'))
const buildStream = (streamId, endpoint, session) => {
  const stream = ffmpeg(`rtmp://localhost/${endpoint}/${streamId}`, { timeout: 432000 })
    // set video bitrate
    .videoBitrate(1200)
    // set h264 preset
    .addOption('-preset', 'superfast')
    // set target codec (this encodes to H.264)
    .videoCodec('libx264')
    // set audio bitrate
    .audioBitrate('256k')
    // set audio codec
    .audioCodec('aac')
    // set number of audio channels
    .audioChannels(2)
    // set hls segments time (chunks are approximately 8 seconds long each)
    .addOption('-hls_time 8')
    // include all the segments in the list (don't remove old segments => for saving / on-demand playback)
    .addOption('-hls_list_size 0')
    //.addOption('-hls_playlist_type', 'event')

    .output(buildHLSPlaylistPath(streamId))

    .inputOptions('-listen 1')

    .on('start', (commandLine) => {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
    })
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
      session.setActive(streamId, false)
      process.exit(0);
    })
    // error handling
    .on('error', function (err) {
      console.log('An error occurred: ' + err.message);
      session.setActive(streamId, false)
      process.exit(0);
    })
    .on('stderr', function (stderrLine) {
      console.log('Stderr output: ' + stderrLine);
    })
    .on('connection', () => {
      console.log('Someone Connected!');
      session.setActive(streamId, true)
    });
  return stream;
};

// The listen command makes FFmpeg act as an RTMP server
//stream._currentInput.options('-listen', 1);

// Saves the file locally
//stream.save('../videoFiles/test.m3u8');


const ffmpegServer =  (session, streamId, endpoint) => {
  console.log(`🎥 FFmpeg Server starting at rtmp://localhost/${endpoint}/${streamId}`);
  buildHLSDir(streamId);
  const stream = buildStream(streamId, endpoint, session);
  session.addStream(streamId);
  stream.run();
};
module.exports = ffmpegServer;
