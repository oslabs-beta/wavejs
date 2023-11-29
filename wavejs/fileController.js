const path = require('node:path');
const fs = require('node:fs');
const crypto = require('crypto');
// const { error, info } = require('./logger');



class FileController {
  constructor(streamId, mediaRoot = '../videoFiles') {
    this._mediaRoot = mediaRoot;
    this._streamId = streamId;
  }
    /* STREAM IDs */
  setStreamId(newId) {
    this._streamId = newId
  }
  getStreamId() {
    return this._streamId;
  }
  generateStreamId() {
    const streamId = crypto.randomUUID();
    // info(`Your stream id is ${streamId}.`);
    return streamId;
  }
  /* HLS Methods*/
  buildHLSDirPath() {
    return path.join(__dirname, this._mediaRoot, 'hls', this._streamId);
  }
  buildHLSPlaylistPath() {
    path.join(this.buildHLSDirPath(this._streamId), 'manifest.m3u8');
  }
  buildHLSDir() {
    const path = this.buildHLSDirPath();
    fs.mkdir(path, { recursive: true }, (err) => {
      if (err) throw err;
    });
  }
  deleteHLSDir() {
    const path = this.buildHLSDirPath(this._streamId);
    fs.rmdir(path, {recursive: true}, (err) => {
      // if (err) error('An error occurred while deleting the HLS directory.');
      // else info('HLS directory successfully deleted.');
    })
  }

  /* MPD Method */
  buildMPDDirPath() {
    return path.join(__dirname, this._mediaRoot, 'mpd', this._streamId);
  }
  buildMPDPlaylistPath() {
    path.join(this.buildMPDDirPath(this._streamId), 'manifest.mpd');
  }
  buildMPDDir() {
    const path = this.buildMPDDirPath();
    fs.mkdir(path, { recursive: true }, (err) => {
      if (err) throw err;
    });
  }
  deleteMPDDir() {
    const path = this.buildMPDDirPath(this._streamId);
    fs.rmdir(path, {recursive: true}, (err) => {
      // if (err) error('An error occurred while deleting the HLS directory.');
      // else info('HLS directory successfully deleted.');
    })
  }
};

const test = new FileController('test')

module.exports = FileController;