const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { error, info } = require('./logger');



class FileController {
  constructor(streamId, mediaRoot = '../videoFiles') {
    this._mediaRoot = mediaRoot;
    this._streamId;
    this.setStreamId(streamId);
  }
    /* STREAM IDs */
  setStreamId(newId) {
    if (typeof newId !=='string') throw new Error(`FileController: only strings can be leveraged, not type '${typeof newId}'`)
    this._streamId = newId
  }
  getStreamId() {
    return this._streamId;
  }
  generateStreamId() {
    const streamId = crypto.randomUUID();
    info(`Your stream id is ${streamId}.`);
    return streamId;
  }
  /* HLS Methods */
  buildHLSDirPath() {
    return path.join(__dirname, this._mediaRoot, 'hls', this._streamId);
  }
  buildHLSPlaylistPath() {
    return path.join(this.buildHLSDirPath(), 'manifest.m3u8');
  }
  buildHLSDir() {
    const path = this.buildHLSDirPath();
    fs.mkdir(path, { recursive: true }, (err) => {
      if (err) throw err;
    });
  }
  deleteHLSDir() {
    const path = this.buildHLSDirPath();
    fs.rmdir(path, {recursive: true}, (err) => {
      if (err) error('An error occurred while deleting the HLS directory.');
      else info('HLS directory successfully deleted.');
    })
  }

  /* MPD Methods */
  buildMPDDirPath() {
    return path.join(__dirname, this._mediaRoot, 'mpd', this._streamId);
  }
  buildMPDPlaylistPath() {
    return path.join(this.buildMPDDirPath(), 'manifest.mpd');
  }
  buildMPDDir() {
    const path = this.buildMPDDirPath();
    fs.mkdir(path, { recursive: true }, (err) => {
      if (err) throw err;
    });
  }
  deleteMPDDir() {
    const path = this.buildMPDDirPath();
    fs.rmdir(path, {recursive: true}, (err) => {
      if (err) error('An error occurred while deleting the HLS directory.');
      else info('HLS directory successfully deleted.');
    })
  }
};


module.exports = FileController;