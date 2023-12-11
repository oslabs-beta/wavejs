const FileController = require('./FileController');
const { EventEmitter } = require('node:events');
const path = require('path')
const fs = require('node:fs')

const streamStorage = {
  outputStreams: new Map(),
  supportedOutputFormats: ['dash', 'hls'],
  publishers: new Map(), // /LIVE/MY_COOL_STREAM, 3908f0_LIVE
  // Track active live streams (each streamKey should only have 1 active live stream at a time)
  playbackLiveStreams: new Map(),
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
  initOutputStream(streamId, streamKey, mediaRoot) {
    const fileController = new FileController(streamId, streamKey, mediaRoot)
    this.outputStreams.set(streamId, {
      _fileController: fileController,
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
    //collect outputStreams from mediaRoot, add to output streams
    // const streams = await fileController.collectStreamsInRoot();
    // streams.forEach(id => {
    //   this.outputStreams.set(id, {
    //     _fileController: new FileController(id, streamKey, mediaRoot),
    //     streams: {
    //       hls: {
    //         filePath: null,
    //         active: false,
    //       },
    //       dash: {
    //         filePath: null,
    //         active: false,
    //       },
    //     },
    //   })
    // })
    
    // let userLiveStreams = this.playbackLiveStreams.get(streamKey)
    // if (userLiveStreams) {
    //   this.playbackLiveStreams.set(streamKey, 
    //     new Set([...userLiveStreams,...streams, streamId]));
    // } else {
    //   this.playbackLiveStreams.set(streamKey, 
    //     new Set([...streams, streamId]));
    // }
  },
  async collectPlaybackStreams(streamId, streamKey, mediaRoot) {
    const fileController = new FileController(streamId, streamKey, mediaRoot)
 //collect outputStreams from mediaRoot, add to output streams
    const streams = await fileController.collectStreamsInRoot();
    console.log('onetime >', streams)
    streams.forEach(id => {
      //initialize output stream
      this.outputStreams.set(id, {
        _fileController: new FileController(id, streamKey, mediaRoot),
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
      //add them
      const userPath = fileController.buildRootUserPath();
      const hlsPath = path.join(userPath, id, 'hls', 'manifest.m3u8')
      const mpdPath = path.join(userPath, id, 'hls', 'manifest.mpd')
      if (fs.existsSync(hlsPath)) {
        this.addOutputStream(id, 'hls', false);
      }
      if (fs.existsSync(mpdPath)) {
        this.addOutputStream(id, 'mpd', false);
      }
    })
    let userLiveStreams = this.playbackLiveStreams.get(streamKey)
    if (userLiveStreams) {
      this.playbackLiveStreams.set(streamKey, 
        new Set([...userLiveStreams,...streams, streamId]));
    } else {
      this.playbackLiveStreams.set(streamKey, 
        new Set([...streams, streamId]));
    }
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
      throw new Error(`StreamID of ${streamId} hasn't been created yet`);
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
