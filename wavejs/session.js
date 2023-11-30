const { buildHLSDirPath } = require('./fileController');
const { PassThrough } = require('node:stream');

const streamStorage = {
  streams: new Map(),
  publisherStreams: new Map(), //3908f0_LIVE, <PassThrough ff ff ff>
  publishers: new Map(), // /LIVE/MY_COOL_STREAM, 3908f0_LIVE
  initializeStream(streamId) {
    this.publisherStreams.set(streamId, {
      res: new PassThrough(),
      numPlayCache: 0,
    });
  },
  
  retrieveStream(streamId) {
    return this.publisherStreams.get(streamId);
  },
  addStream(streamId, active = true) {
    this.streams.set(streamId, {
      active,
      address: buildHLSDirPath(streamId),
    });
    return;
  },
  getStream(streamId) {
    return this.streams.get(streamId);
  },
  setActive(streamId, active = false) {
    const stream = this.streams.get(streamId);
    if (stream.active === active) return;
  
    this.streams.set(streamId, { ...stream, active });
  },

};

/*
  {
    active:
    fileAddress:
  }
*/


module.exports = streamStorage;
