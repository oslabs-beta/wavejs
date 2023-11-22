// Require the ffmpeg library:
const ffmpeg = require('fluent-ffmpeg');
//const logger = require('./logger')
const net = require('node:net');
const { buildHLSPlaylistPath, buildHLSDir } = require('./fileControllerstub');
const session = require('./session');
// console.log(path.join(__dirname,'../VideoFiles'))
const buildStream = (streamId) => {
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
    })
    // error handling
    .on('error', function (err) {
      console.log('An error occurred: ' + err.message);
      process.exit(0);
    })
    .on('stderr', function (stderrLine) {
      console.log('Stderr output: ' + stderrLine);
    })
    .on('connection', () => {
      console.log('Someone Connected!');
    });
  return stream;
};

// The listen command makes FFmpeg act as an RTMP server
//stream._currentInput.options('-listen', 1);

// Saves the file locally
//stream.save('../videoFiles/test.m3u8');
const portCheck = (host, port, timeout = 400) => {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let status = null;
    let error = null;
    let connectionRefused = false;
    socket.on('connect', () => {
      console.log('portcheck: connect');
      status = 'open';
      socket.destroy();
    });
    socket.setTimeout(timeout);
    socket.on('timeout', () => {
      console.log('portcheck: timeout');
      status = 'in-use';
      socket.destroy();
    });
    socket.on('error', (err) => {
      console.log('portcheck: error');
      // if (err.code !== 'ECONNREFUSED') {
      //   error = err
      // } else {
      //   connectionRefused = true
      // }
      error = err;
      status = 'in-use';
    });
    socket.on('close', (err) => {
      if (err && !connectionRefused) {
        error = error || err;
      } else {
        error = null;
      }
      console.log('portcheck: close');
      return resolve([status, error, connectionRefused]);
    });
    socket.connect({ port: port });
  });
};

// let [status, error] = portCheck('tcp://localhost', 1935)

const main = async () => {
  console.log('Stream starting...');
  buildHLSDir('test');
  const stream = buildStream('test');
  session.addStream('test');
  stream.run();
};
main();
