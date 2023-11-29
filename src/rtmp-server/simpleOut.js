const { PassThrough } = require('node:stream')

/*
data: {
  audio: new PassThrough()
}
*/

const streamStorage = { 
  data: new Map(),
  initializeStream: (streamId) => {
    this.data.set(streamId, {
      audio: new PassThrough(),
      video: new PassThrough(),
    });
  },
  writeStreamAudio: (streamId, buffer) => {
    const stream = this.data.get(streamId);
    stream.audio.write(buffer);
    this.data.set(streamId, stream);
  },
  writeStreamVideo: (streamId) => {
    const stream = this.data.get(streamId);
    stream.video.write(buffer);
    this.data.set(streamId, stream);
  },
  retrieveStream: (streamId) => {
    return this.data.get(streamId);
  }
}




module.exports = streamStorage;