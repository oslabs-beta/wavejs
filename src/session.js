const { buildHLSPlaylistPath } = require('./fileControllerstub');

const session = {
  streams: new Map(),
};

/*
  {
    active:
    fileAddress:
  }
*/

session.addStream = function (streamId, active = true) {
  this.streams.set(streamId, {
    active,
    address: buildHLSPlaylistPath(streamId),
  });
  return;
};

session.setActive = function (streamId, active = false) {
  const stream = this.streams.get(streamId);
  if (stream.active === active) return;

  this.streams.set(streamId, { ...stream, active });
};

module.exports = session;
