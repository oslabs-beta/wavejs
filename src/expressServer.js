const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const path = require('path');
const m3u8stream = require('m3u8stream');
const { buildHLSDirPath, buildHLSSegmentPath } = require('./fileController');
const session = require('./session');

const { expressHttpLogger } = require('./logger');

const demoFLVPath = path.join(
  __dirname,
  '../test_files',
  'sample_960x400_ocean_with_audio.flv'
);

const contentTypes = {
  '.flv': 'video/x-flv',
  '.mp4': 'video/mp4',
  '.m3u8': 'application/x-mpegURL',
  '.mpd': 'application/dash+xml',
};
const PORT = 3000;

const main = () => {
  const app = express();

  /* initial config */
  app.disable('x-powered-by');

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(expressHttpLogger);

  app.get('/test', (req, res) => {
    res.status(200).json('recieved!');
  });

  app.get('/streams', (req, res) => {
    res.status(200).json(Object.fromEntries(session.streams));
  });

  //get playlist route
  app.get('/video/:streamId/:m3u8', (req, res) => {
    //this is the area where we need to connect fmpg to the server
    const videoPath = `${buildHLSDirPath(req.params.streamId)}/${req.params.m3u8}`
   //'application/vnd.apple.mpegurl'
    res.status(200).set('Content-Type', contentTypes['.m3u8'])
    fs.createReadStream(videoPath).pipe(res);
  
  });

  // //dynamically get segments
  // app.get('/video/manifest:id.ts', (req, res) => {
  //   const videoPath = buildHLSSegmentPath('test', req.params.id);
  //   console.log(videoPath);
  //   const head = {
  //     'Accept-Ranges': 'bytes',
  //     'Content-Type': contentTypes['.m3u8'],
  //   };
  //   res.writeHead(206, head);
  //   const stream = fs.createReadStream(videoPath);
  //   stream.pipe(res);
  // });

  app.use((req, res, next) => {
    res.status(404).send("😵 Can't find what you're looking for!");
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('☠️ Something Broke!');
  });

  let server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`🚀 Express blasting off on port ${PORT}`);
  });
};

main();
