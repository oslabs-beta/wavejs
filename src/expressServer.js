const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const path = require('path');
const qs = require('qs')

const { expressHttpLogger } = require('./logger')


const demoFLVPath = path.join(__dirname, '../test_files', 'sample_960x400_ocean_with_audio.flv' )

const contentTypes = {
  '.flv': 'video/x-flv',
  '.mp4': 'video/mp4',
  '.m3u8': 'application/x-mpegURL',
  '.mpd': 'application/dash+xml',

}

const PORT = 3000;

const app = express();

/* initial config */
app.disable('x-powered-by');


app.use(express.urlencoded({extended: true}))
app.use(express.json());
app.use(expressHttpLogger);


app.get('/test', (req,res) => {
  res.status(200).json('recieved!')
})

app.get("/video/:id", function (req, res) {
  //this is the area where we need to connect fmpg to the server
  const videoPath = demoFLVPath//path.join(__dirname, '../media/', `${req.params.id}.flv`)
  
  const videoStat = fs.statSync(videoPath);
  const fileSize = videoStat.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1]
        ? parseInt(parts[1], 10)
        : fileSize-1;
    const chunksize = (end-start) + 1;
    //this stream should come from ffmpeg directly
    const file = fs.createReadStream(videoPath, {start, end});
    const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentTypes['.flv'],
    };
    res.writeHead(206, head);
    //we need to pipe from ffmpeg here
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/x-flv',
  };
    res.writeHead(200, head);
    //we need to pipe from ffmpeg here
    fs.createReadStream(videoPath).pipe(res);
  }
})


app.use((req,res,next) => {
  res.status(404).send("😵 Can't find what you're looking for!")
})

app.use((err, req,res,next) => {
  console.error(err.stack)
  res.status(500).send("☠️ Something Broke!")
})

let server = http.createServer(app);

server.listen(PORT, ()=> {
  console.log(`🚀 Express blasting off on port ${PORT}`)
})