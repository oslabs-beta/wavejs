const path = require('node:path');
const fs = require('node:fs');
const crypto = require('crypto');
const { error, info } = require('./logger');

const generateStreamId = () => {
  const streamId = crypto.randomUUID();
  info(`Your stream id is ${streamId}.`);
}

const buildHLSDirPath = (streamId) =>
  path.join(__dirname, '../videoFiles', streamId);

const buildHLSPlaylistPath = (streamId) =>
  path.join(buildHLSDirPath(streamId), 'manifest.m3u8');

const buildHLSDir = (streamId) => {
  const path = buildHLSDirPath(streamId);
  fs.mkdir(path, { recursive: true }, (err) => {
    if (err) throw err;
  });
};

const buildHLSSegmentPath = (streamId, segment) => path.join(buildHLSDirPath(streamId), `manifest${segment}.ts`)

console.log(buildHLSPlaylistPath('test'));

const deleteHLSDir = (streamId) => {
  const path = buildHLSDirPath(streamId);
  fs.rmdir(path, {recursive: true}, (err) => {
    if (err) error('An error occurred while deleting the HLS directory.');
    else info('HLS directory successfully deleted.');
  })
}

module.exports = {
  generateStreamId,
  buildHLSPlaylistPath,
  buildHLSDirPath,
  buildHLSDir,
  buildHLSSegmentPath,
  deleteHLSDir
};
