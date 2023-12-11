const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs')
const crypto = require('node:crypto');
const { error, info } = require('./logger');

class FileController {
  constructor(streamId, streamKey, mediaRoot = path.join(__dirname, '../videoFiles')) {
    this._mediaRoot = mediaRoot;
    this.streamKey = streamKey;
    this._streamId;
    this.setStreamId(streamId);
  }
  /* STREAM IDs */
  setStreamId(newId) {
    if (typeof newId !== 'string')
      throw new Error(
        `FileController: only strings can be leveraged, not type '${typeof newId}'`
      );
    this._streamId = newId;
  }
  getStreamId() {
    return this._streamId;
  }
  generateStreamId() {
    const streamId = crypto.randomUUID();
    info(`Your stream id is ${streamId}.`);
    return streamId;
  }
  async collectStreamsInRoot() {
    const rootDir = this.buildRootDirPath();
    let streamIds =  await fs.readdir(rootDir);
    streamIds = streamIds.filter((id) => {
      let hlsPath = path.join(rootDir, id, 'hls', 'manifest.m3u8');
      let mpdPath = path.join(rootDir, id, 'mpd', 'manifest.mpd');
      return (fsSync.existsSync(hlsPath) || fsSync.existsSync(mpdPath)) ? 
      true : false;
    });
    return streamIds;
  }
  buildRootDirPath() {
    info('[onetime]', 'mediaRoot', this._mediaRoot, 'streamKey', this.streamKey, 'streamId', this._streamId);
    return path.join(
      this._mediaRoot,
      this.streamKey,
      this._streamId,
    );
  }
  /* HLS Methods */
  buildHLSDirPath() {
    return path.join(
      this.buildRootDirPath(),
      'hls'
    );
  }
  buildHLSPlaylistPath() {
    return path.join(this.buildHLSDirPath(), 'manifest.m3u8');
  }
  
  async buildHLSDir() {
    const path = this.buildHLSDirPath();
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (err) {
      error(err);
    }
  }
  async deleteHLSDir() {
    const path = this.buildHLSDirPath();
    info(path);
    try {
      await fs.rm(path, { recursive: true, force: true });
    } catch (err) {
      error(err);
    }
    info('deleteHLSDirCallled');
  }

  /* MPD Methods */
  buildMPDDirPath() {
    return path.join(
      this.buildRootDirPath(),
      'mpd'
    );
  }
  buildMPDPlaylistPath() {
    return path.join(this.buildMPDDirPath(), 'manifest.mpd');
  }
  async buildMPDDir() {
    const path = this.buildMPDDirPath();
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (err) {
      error(err);
    }
  }
  async deleteMPDDir() {
    const path = this.buildMPDDirPath();
    try {
      await fs.rm(path, { recursive: true, force: true });
    } catch (err) {
      error(err);
    }
  }
}

module.exports = FileController;
