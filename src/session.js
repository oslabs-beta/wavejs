const { buildHLSDirPath } = require('./fileController');
const { PassThrough } = require('node:stream');

const streamStorage = {
  streams: new Map(),
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
};

/*
  {
    active:
    fileAddress:
  }
*/

streamStorage.addStream = function (streamId, active = true) {
  this.streams.set(streamId, {
    active,
    address: buildHLSDirPath(streamId),
  });
  return;
};

streamStorage.getStream = function (streamId) {
  return this.streams.get(streamId);
};

streamStorage.setActive = function (streamId, active = false) {
  const stream = this.streams.get(streamId);
  if (stream.active === active) return;

  this.streams.set(streamId, { ...stream, active });
};

module.exports = streamStorage;
