const { PassThrough } = require('node:stream')
const streamStorage = { 
  publisherStreams: new Map(),
  publishers: new Map(),
  initializeStream: function (streamId) {
    this.publisherStreams.set(streamId, {
      res: new PassThrough(),
      numPlayCache: 0,
    });
  },
  
  retrieveStream: function (streamId) {
    return this.publisherStreams.get(streamId);
  },
  
}

console.log(streamStorage.retrieveStream('stuff'))