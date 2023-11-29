const path = require('node:path');
const fs = require('node:fs');
const crypto = require('crypto');
const { error, info } = require('./logger');



const FileController = (Id) => {
  let streamId = Id;
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
    buildHLSDirPath() {
      return path.join(__dirname, '../videoFiles', 'hls', streamId);
    },
    buildHLSPlaylistPath() {
      path.join(this.buildHLSDirPath(streamId), 'manifest.m3u8');
    },
    buildHLSDir() {
      const path = this.buildHLSDirPath();
      fs.mkdir(path, { recursive: true }, (err) => {
        if (err) throw err;
      });
    },
    deleteHLSDir() {
      const path = this.buildHLSDirPath(streamId);
      fs.rmdir(path, {recursive: true}, (err) => {
        if (err) error('An error occurred while deleting the HLS directory.');
        else info('HLS directory successfully deleted.');
      })
    },

    /* MPD Method */
    buildMPDDirPath() {
      return path.join(__dirname, '../videoFiles', 'mpd', streamId);
    },
    buildMPDPlaylistPath() {
      path.join(this.buildMPDDirPath(streamId), 'manifest.mpd');
    },
    buildMPDDir() {
      const path = this.buildMPDDirPath();
      fs.mkdir(path, { recursive: true }, (err) => {
        if (err) throw err;
      });
    },
    deleteMPDDir() {
      const path = this.buildMPDDirPath(streamId);
      fs.rmdir(path, {recursive: true}, (err) => {
        if (err) error('An error occurred while deleting the HLS directory.');
        else info('HLS directory successfully deleted.');
      })
    },
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
