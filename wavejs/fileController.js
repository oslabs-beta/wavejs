const path = require('node:path');
const fs = require('node:fs');
const crypto = require('crypto');
const { error, info } = require('./logger');

const generateStreamId = () => {
  const streamId = crypto.randomUUID();
  info(`Your stream id is ${streamId}.`);
}

const FileController = (streamId) => {
  let streamId = streamId;
  return {
    /* STREAM IDs */
    setStreamId(newId) {
      streamId = newId
    },
    getStreamId() {
      return streamId;
    },
    generateStreamId() {
      const streamId = crypto.randomUUID();
      info(`Your stream id is ${streamId}.`);
      return streamId;
    },
    /* HLS Methods*/
    buildHLSDir() {
      path.join(__dirname, '../videoFiles', streamId);
    },
    deleteHLSDir() {
      const path = buildHLSDirPath(streamId);
      fs.rmdir(path, {recursive: true}, (err) => {
        if (err) error('An error occurred while deleting the HLS directory.');
        else info('HLS directory successfully deleted.');
      })
    },
    buildHLSPlaylistPath() {
      path.join(buildHLSDirPath(streamId), 'manifest.m3u8');
    },
    /* MPD Method */
     buildMPDDir() {
      path.join(__dirname, '../videoFiles', 'mpd', streamId);
    },
    deleteMPDDir() {
      const path = buildHLSDirPath(streamId);
      fs.rmdir(path, {recursive: true}, (err) => {
        if (err) error('An error occurred while deleting the MPD directory.');
        else info('HLS directory successfully deleted.');
      })
    },
    buildMPDPlaylistPath() {
      path.join(buildHLSDirPath(streamId), 'manifest.m3u8');
    }
  };
};


module.exports = {
  generateStreamId,
  buildHLSPlaylistPath,
  buildHLSDirPath,
  buildHLSDir,
  buildHLSSegmentPath,
  deleteHLSDir
};
