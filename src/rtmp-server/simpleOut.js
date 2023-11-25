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
      streamData: new PassThrough(),
      numPlayCache: 0,
    });
  },
  
  retrieveStream: (streamId) => {
    return this.data.get(streamId);
  }
}




module.exports = streamStorage;