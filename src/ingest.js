// Require the ffmpeg library:
const ffmpeg = require('fluent-ffmpeg');

const stream = ffmpeg('rtmp://localhost/live', { timeout: 432000 })
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
  .addOption('-hls_time', 8)
  // include all the segments in the list (don't remove old segments => for saving / on-demand playback)
  .addOption('-hls_playlist_type', 'event')
  // event handler for end of stream
  .on('end', function () {
    console.log('Success! Your live stream has been saved.');
  })
  // error handling
  .on('error', function (err) {
    console.log('An error occurred: ' + err.message);
  });

// The listen command makes FFmpeg act as an RTMP server
stream._currentInput.options('-listen', 1);

// Saves the file locally
stream.save('../videoFiles/test.m3u8');
