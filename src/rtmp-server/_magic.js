//const streamStorage = require('./simpleOut')
const utils = require('./rtmp-utils');

const config = {
  port: 1935,
  chunk_size: 60000,
  gop_cache: true,
  handshake_size: 1536,
  packetType: {
    sequenceStart: 0,
    codedFrames: 1,
    sequenceEnd: 2,
    codedFramesX: 3,
    metadata: 4,
    MPEG2TSSequenceStart: 5,
  },
  fourCC: {
    AV1: Buffer.from('av01'),
    VP9: Buffer.from('vp09'),
    HEVC: Buffer.from('hvc1'),
  },
  handshakeStages: {
    uninit: 0, //c0
    c1_to_s0_s1_s2: 1, //c1 - the random bytes, send s0, s1, and s2
    c2_to_connection: 2, //recieve c2, connection
    begin_processing: 3, //start processing data
  },
  maxChunkHeader: 18,
  rtmpHeaderSize: [11, 7, 3, 0], //11-bytes, 7-bytes, 3-bytes, 0-bytes
  chunkType: {
    bytes11: 0, // 11-bytes: timestamp(3) + length(3) + stream type(1) + stream id(4)
    bytes7: 1, // 7-bytes: delta(3) + length(3) + stream type(1)
    bytes3: 2, // 3-bytes: delta(3)
    bytes0: 3, //0-bytes: n/a
  },
  channel: {
    protocol: 2,
    invoke: 3,
    audio: 4,
    video: 5,
    data: 6,
  },
  type: {
    /* protocol control messages*/
    setChunkSize: 1,
    abort: 2,
    acknowledgement: 3, //bytes read report
    acknowledgementSize: 5, //server bandwith
    setPeerBandwith: 6, //client bandwith
    /* user control messages */
    event: 4,
    audio: 8,
    video: 9,
    /* data messages */
    flexStream: 15, //AMF3
    data: 18, // AMF0
    /* shared object messages */
    flexObject: 16, //AMF3
    sharedObject: 19, //AMF0
    /* command messages */
    flexMessage: 17, //AMF3
    invoke: 20, //AMF0
    /* aggregate message */
    metadata: 22,
  },
  parserStages: {
    init: 0,
    basicHeader: 1,
    messageHeader: 2,
    extendedTimestamp: 3,
    payload: 4,
  },
  defaultChunkSize: 128,
  audio: {
    codecName: [
      '',
      'ADPCM',
      'MP3',
      'LinearLE',
      'Nellymoser16',
      'Nellymoser8',
      'Nellymoser',
      'G711A',
      'G711U',
      '',
      'AAC',
      'Speex',
      '',
      'OPUS',
      'MP3-8K',
      'DeviceSpecific',
      'Uncompressed',
    ],
    soundRate: [5512, 11025, 22050, 44100],
    sampleRate: [
      96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000,
      11025, 8000, 7350, 0, 0, 0,
    ],
    aacChannels: [0, 1, 2, 3, 4, 5, 6, 8],
  },
  video: {
    codecName: [
      '',
      'Jpeg',
      'Sorenson-H263',
      'ScreenVideo',
      'On2-VP6',
      'On2-VP6-Alpha',
      'ScreenVideo2',
      'H264',
      '',
      '',
      '',
      '',
      'H265',
      'AV1',
    ],
  },
};

const state = {
  socket: null,
  id: utils.generateSessionID(),
  ip: this.socket ? this.socket.remoteAddress : null,
  handshake: {
    handshakeStage: config.handshakeStages.uninit,
    handshakeBytes: 0,
    handshakePayload: Buffer.alloc(config.handshake_size),
  },
  streams: {
    count: 0, //not sure what this is for
    publish: {
      id: 0,
      path: '',
      args: {},
    },
    play: {
      // may not need this at all
      id: 0,
      path: '',
      args: {},
    },
  },
  parserState: config.parserStages.init,
  parserBytes: 0,
  parserBasicBytes: 0,
  parserBuffer: Buffer.alloc(config.maxChunkHeader),
  parserPacket: null,
  metaData: null,
  pingInterval: null,
  recievedPackets: new Map(), //inPackets
  rtmpGopCacheQueue: new Set(), //this is conditional in NMS
  isLocal: this.ip
    ? this.ip === '127.0.0.1' ||
      this.ip === '::1' ||
      this.ip == '::ffff:127.0.0.1'
    : null,
  status: {
    isStarting: false,
    isPublishing: false,
    isPlaying: false,
    isIdling: false,
    isPause: false,
    isReceiveAudio: true,
    isReceiveVideo: true,
  },
  connect: {
    cmdObj: null,
    appname: '',

    objectEncoding: 0, //not instantiated in constructor in nms
    time: null, //not instantiated in constructor in nms
    startTimestamp: null, //not instantiated in constructor in nms
    pingInterval: null,
    pingTime: 60000, //this is configurable in NMS
    pingTimeout: 30000, //this is configurable in NMS
    bitrateCache: {
      intervalMS: 0,
      last_update: null,
      bytes: 0,
    },
  },
  chunkSize: {
    input: config.defaultChunkSize,
    output: config.defaultChunkSize, //need to make this configurable the same way NMS does it either the config option (6000) or this
  },
  ack: {
    size: 0,
    inSize: 0,
    inLast: 0,
  },
  bitrate: {
    current: 0,
    cache: {},
  },
  audio: {
    codec: 0,
    codecName: '',
    profileName: '',
    sampleRate: 0,
    channels: 1,
    aacSequenceHeader: null,
  },
  video: {
    codec: 0,
    codecName: '',
    profileName: '',
    width: 0,
    height: 0,
    fps: 0,
    count: 0,
    level: 0,
    avcSequenceHeader: null,
  },
  setSocket: function (socket) {
    this.socket = socket;
    this.ip = this.socket.remoteAddress;
  },
  setId: function () {
    this.id = utils.generateSessionID();
  },
};

state.setSocket('test');
module.exports = { config, state };
