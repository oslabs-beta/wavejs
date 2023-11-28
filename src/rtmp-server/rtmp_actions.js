//rtmpChunks Create is needed here
const utils = require('./utils');
const RtmpPacket = require('./RtmpPacket');
const AMF = require('./node_core_amf');

/*
All can be partialed in this file
*/

const sendACK = (config, state, size) => {
  let rtmpBuffer = Buffer.from('02000000000004030000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  state.socket.write(rtmpBuffer);
};

const sendWindowACK = (config, state, size) => {
  let rtmpBuffer = Buffer.from('02000000000004050000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  state.socket.write(rtmpBuffer);
};

const setPeerBandwidth = (config, state, size, type) => {
  let rtmpBuffer = Buffer.from('0200000000000506000000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  rtmpBuffer[16] = type;
  state.socket.write(rtmpBuffer);
};

const setChunkSize = (config, state, size) => {
  let rtmpBuffer = Buffer.from('02000000000004010000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  state.socket.write(rtmpBuffer);
};

const sendStreamStatus = (config, state, st, id) => {
  let rtmpBuffer = Buffer.from('020000000000060400000000000000000000', 'hex');
  rtmpBuffer.writeUInt16BE(st, 12);
  rtmpBuffer.writeUInt32BE(id, 14);
  state.socket.write(rtmpBuffer);
};

const sendPingRequest = (config, state) => {
  let currentTimestamp = Date.now() - state.connect.startTimestamp;
  let packet = RtmpPacket.create();
  packet.header.fmt = config.chunkType.bytes11;
  packet.header.cid = config.channel.protocol;
  packet.header.type = config.type.event;
  packet.header.timestamp = currentTimestamp;
  packet.payload = Buffer.from([
    0,
    6,
    (currentTimestamp >> 24) & 0xff,
    (currentTimestamp >> 16) & 0xff,
    (currentTimestamp >> 8) & 0xff,
    currentTimestamp & 0xff,
  ]);
  packet.header.length = packet.payload.length;
  let chunks = utils.rtmpChunksCreate(config, state, packet);
  state.socket.write(chunks);
};

const respondConnect = (config, state, tid) => {
  let opt = {
    cmd: '_result',
    transId: tid,
    cmdObj: {
      fmsVer: 'FMS/3,0,1,123',
      capabilities: 31,
    },
    info: {
      level: 'status',
      code: 'NetConnection.Connect.Success',
      description: 'Connection succeeded.',
      objectEncoding: state.connect.objectEncoding,
    },
  };
  sendInvokeMessage(config, state, 0, opt);
};

const sendInvokeMessage = (config, state, sid, opt) => {
  let packet = RtmpPacket.create();
  packet.header.fmt = config.chunkTypes.bytes11;
  packet.header.cid = config.channel.invoke;
  packet.header.type = config.type.invoke;
  packet.header.stream_id = sid;
  packet.payload = AMF.encodeAmf0Cmd(opt);
  packet.header.length = packet.payload.length;
  let chunks = utils.rtmpChunksCreate(config, state, packet);
  state.socket.write(chunks);
};

const respondCreateStream = (config, state, tid) => {
  state.streams.count++;
  let opt = {
    cmd: '_result',
    transId: tid,
    cmdObj: null,
    info: state.streams.count,
  };
  sendInvokeMessage(config, state, 0, opt);
};

const sendStatusMessage = (config, state, sid, level, code, description) => {
  let opt = {
    cmd: 'onStatus',
    transId: 0,
    cmdObj: null,
    info: {
      level: level,
      code: code,
      description: description,
    },
  };
  sendInvokeMessage(config, state, sid, opt);
};

module.exports = {
  sendACK,
  sendWindowACK,
  setPeerBandwidth,
  setChunkSize,
  sendStreamStatus,
  sendPingRequest,
  sendInvokeMessage,
  respondConnect,
  respondCreateStream,
  sendStatusMessage,
};
