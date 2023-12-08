const FileController = require('./FileController');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');

const streamStorage = {
  outputStreams: new Map(),
  supportedOutputFormats: ['dash', 'hls'],
  publishers: new Map(), // /LIVE/MY_COOL_STREAM, 3908f0_LIVE
  // Track active live streams (each streamKey should only have 1 active live stream at a time)
  activeLiveStreams: new Map(),
  ffmpegPorts: new Map(),
  /* FfmpegPort Methods */
  registerFfmpegPort(portNumber) {
    this.ffmpegPorts.set(String(portNumber), 'active port');
  },
  checkForActiveFfmpegPorts(portNumber) {
    return this.ffmpegPorts.has(String(portNumber));
  },
  events: new EventEmitter(),

  /* output Stream Methods */
  initOutputStream(streamId, streamKey) {
    this.outputStreams.set(streamId, {
      _fileController: new FileController(streamId, streamKey),
      streams: {
        hls: {
          filePath: null,
          active: false,
        },
        dash: {
          filePath: null,
          active: false,
        },
      },
    });
    this.activeLiveStreams.set(streamKey, streamId);
  },
  addOutputStream(streamId, protocol, active = true) {
    // Main error checking on protocol, active
    if (!this.supportedOutputFormats.includes(protocol))
      throw new Error(
        `Stream Storage: protocol of '${protocol}' not included in accepted formats: ${this.supportedOutputFormats.join(
          ', '
        )}}`
      );
    if (typeof active !== 'boolean')
      throw new Error(
        `Stream Storage: active needs to be boolean, not type ${typeof active}`
      );
    //main switch statement
    switch (protocol) {
      case 'dash': {
        const state = this.outputStreams.get(streamId);
        state.streams.dash.filePath = state._fileController.buildMPDDirPath();
        state._fileController.buildMPDDir();
        state.streams.dash.active = active;
        this.outputStreams.set(streamId, state);
        break;
      }
      case 'hls': {
        const state = this.outputStreams.get(streamId);
        state.streams.hls.filePath = state._fileController.buildHLSDirPath();
        state._fileController.buildHLSDir();
        state.streams.hls.active = active;
        this.outputStreams.set(streamId, state);
        break;
      }
      default:
        throw new Error(`StreamStorage: protocol of ${protocol} not accepted.`);
    }
  },
  getOutputStreamPath(streamId, protocol) {
    if (!this.supportedOutputFormats.includes(protocol))
      throw new Error(
        `Stream Storage: protocol of '${protocol}' not included in accepted formats: ${this.supportedOutputFormats.join(
          ', '
        )}}`
      );
    const state = this.outputStreams.get(streamId);
    if (state === undefined)
      throw new Error("StreamID hasn't been created yet");
    switch (protocol) {
      case 'dash': {
        return state.streams.dash.filePath;
      }
      case 'hls': {
        return state.streams.hls.filePath;
      }
      default:
        throw new Error(`StreamStorage: protocol of ${protocol} not accepted.`);
    }
  },
  setOutputStreamActive(streamId, protocol, active = true) {
    if (!this.supportedOutputFormats.includes(protocol))
      throw new Error(
        `Stream Storage: protocol of '${protocol}' not included in accepted formats: ${this.supportedOutputFormats.join(
          ', '
        )}}`
      );
    const state = this.outputStreams.get(streamId);
    switch (protocol) {
      case 'dash': {
        if (state.streams.dash.active === active) return;
        else {
          state.streams.dash.active = active;
          this.outputStreams.set(streamId, state);
          return;
        }
      }
      case 'hls': {
        if (state.streams.hls.active === active) return;
        else {
          state.streams.hls.active = active;
          this.outputStreams.set(streamId, state);
          return;
        }
      }
      default:
        throw new Error(`StreamStorage: protocol of ${protocol} not accepted.`);
    }
  },
  async deleteOutputStream(streamId, protocol) {
    if (!this.supportedOutputFormats.includes(protocol))
      throw new Error(
        `Stream Storage: protocol of '${protocol}' not included in accepted formats: ${this.supportedOutputFormats.join(
          ', '
        )}}`
      );
    const state = this.outputStreams.get(streamId);
    switch (protocol) {
      case 'dash': {
        await state._fileController.deleteMPDDir();
        return;
      }
      case 'hls': {
        await state._fileController.deleteHLSDir();
        return;
      }
      default:
        throw new Error(`StreamStorage: protocol of ${protocol} not accepted.`);
    }
  },
};

module.exports = streamStorage;
