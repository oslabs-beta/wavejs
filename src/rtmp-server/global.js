const { PassThrough } = require('node:stream')

/*
data: {
  audio: new PassThrough()
}
*/

const streamStorage = { 
  publisherStreams: new Map(),
  publishers: new Map(),
  initializeStream(streamId) {
    this.publisherStreams.set(streamId, {
      res: new PassThrough(),
      numPlayCache: 0,
    });
  },
  
  retrieveStream(streamId) {
    return this.publisherStreams.get(streamId);
  },
  
}




module.exports = streamStorage;