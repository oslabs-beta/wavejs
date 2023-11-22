const path = require('node:path');
const fs = require('node:fs');

const buildHLSDirPath = (streamId) =>
  path.join(__dirname, '../VideoFiles', streamId);

const buildHLSPlaylistPath = (streamId) =>
  path.join(buildHLSDirPath(streamId), 'manifest.m3u8');

const buildHLSDir = (streamId) => {
  const path = buildHLSDirPath(streamId);
  fs.mkdir(path, { recursive: true }, (err) => {
    if (err) throw err;
  });
};


module.exports = {
  buildHLSPlaylistPath,
  buildHLSDirPath,
  buildHLSDir,

};