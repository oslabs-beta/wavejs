//rtmpChunks Create is needed here


const sendACK = (size, socket) => {
  let rtmpBuffer = Buffer.from('02000000000004030000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  socket.write(rtmpBuffer);
}

const sendWindowACK = (size, socket) => {
  let rtmpBuffer = Buffer.from('02000000000004050000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  socket.write(rtmpBuffer);
}

const setPeerBandwidth = (size, type, socket) => {
  let rtmpBuffer = Buffer.from('0200000000000506000000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  rtmpBuffer[16] = type;
  socket.write(rtmpBuffer);
}

const setChunkSize = (size, socket) => {
  let rtmpBuffer = Buffer.from('02000000000004010000000000000000', 'hex');
  rtmpBuffer.writeUInt32BE(size, 12);
  socket.write(rtmpBuffer);
};

const sendStreamStatus = (st, id, socket) => {
  let rtmpBuffer = Buffer.from('020000000000060400000000000000000000', 'hex');
  rtmpBuffer.writeUInt16BE(st, 12);
  rtmpBuffer.writeUInt32BE(id, 14);
  socket.write(rtmpBuffer);
};

module.exports =  {
  sendACK,
  sendWindowACK,
  setPeerBandwidth,
  setChunkSize,
  sendStreamStatus,
}