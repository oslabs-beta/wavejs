const { PassThrough } = require('node:stream')

/*
data: {
  audio: new PassThrough()
}
*/

const streamStorage = { 
  sessions: new Map(),
  publishers: new Map(),
  initializeStream: (streamId) => {
    this.sessions.set(streamId, {
      streamData: new PassThrough(),
      numPlayCache: 0,
    });
  },
  
  retrieveStream: (streamId) => {
    return this.sessions.get(streamId);
  },
  
}




module.exports = streamStorage;