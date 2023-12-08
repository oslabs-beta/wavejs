/*
rtmpChunksCreate shoudl be partialed
*/

const rtmpChunksCreate = (config, state, packet) => {
  let header = packet.header;
  let payload = packet.payload;
  let payloadSize = header.length;
  let chunkSize = state.chunkSize.output;
  let chunksOffset = 0;
  let payloadOffset = 0;
  let chunkBasicHeader = rtmpChunkBasicHeaderCreate(header.fmt, header.cid);
  let chunkBasicHeader3 = rtmpChunkBasicHeaderCreate(
    config.chunkType.bytes0,
    header.cid
  );
  let chunkMessageHeader = rtmpChunkMessageHeaderCreate(config, state, header);
  let useExtendedTimestamp = header.timestamp >= 0xffffff;
  let headerSize =
    chunkBasicHeader.length +
    chunkMessageHeader.length +
    (useExtendedTimestamp ? 4 : 0);
  let n = headerSize + payloadSize + Math.floor(payloadSize / chunkSize);
  if (useExtendedTimestamp) {
    n += Math.floor(payloadSize / chunkSize) * 4;
  }
  if (!(payloadSize % chunkSize)) {
    n -= 1;
    if (useExtendedTimestamp) {
      //TODO CHECK
      n -= 4;
    }
  }
  let chunks = Buffer.alloc(n);
  chunkBasicHeader.copy(chunks, chunksOffset);
  chunksOffset += chunkBasicHeader.length;
  chunkMessageHeader.copy(chunks, chunksOffset);
  chunksOffset += chunkMessageHeader.length;
  if (useExtendedTimestamp) {
    chunks.writeUInt32BE(header.timestamp, chunksOffset);
    chunksOffset += 4;
  }
  while (payloadSize > 0) {
    if (payloadSize > chunkSize) {
      payload.copy(
        chunks,
        chunksOffset,
        payloadOffset,
        payloadOffset + chunkSize
      );
      payloadSize -= chunkSize;
      chunksOffset += chunkSize;
      payloadOffset += chunkSize;
      chunkBasicHeader3.copy(chunks, chunksOffset);
      chunksOffset += chunkBasicHeader3.length;
      if (useExtendedTimestamp) {
        chunks.writeUInt32BE(header.timestamp, chunksOffset);
        chunksOffset += 4;
      }
    } else {
      payload.copy(
        chunks,
        chunksOffset,
        payloadOffset,
        payloadOffset + payloadSize
      );
      payloadSize -= payloadSize;
      chunksOffset += payloadSize;
      payloadOffset += payloadSize;
    }
  }
  return chunks;
};

const rtmpChunkBasicHeaderCreate = (fmt, cid) => {
  let out;
  if (cid >= 64 + 255) {
    out = Buffer.alloc(3);
    out[0] = (fmt << 6) | 1;
    out[1] = (cid - 64) & 0xff;
    out[2] = ((cid - 64) >> 8) & 0xff;
  } else if (cid >= 64) {
    out = Buffer.alloc(2);
    out[0] = (fmt << 6) | 0;
    out[1] = (cid - 64) & 0xff;
  } else {
    out = Buffer.alloc(1);
    out[0] = (fmt << 6) | cid;
  }
  return out;
};

const rtmpChunkMessageHeaderCreate = (config, state, header) => {
  let out = Buffer.alloc(config.rtmpHeaderSize[header.fmt % 4]);
  if (header.fmt <= config.chunkType.bytes3) {
    out.writeUIntBE(
      header.timestamp >= 0xffffff ? 0xffffff : header.timestamp,
      0,
      3
    );
  }

  if (header.fmt <= config.chunkType.bytes7) {
    out.writeUIntBE(header.length, 3, 3);
    out.writeUInt8(header.type, 6);
  }

  if (header.fmt === config.chunkType.bytes11) {
    out.writeUInt32LE(header.stream_id, 7);
  }
  return out;
};

const generateSessionID = () => {
  let sessionId = '';
  const accepted = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  for (let i = 0; i < 8; i++) {
    sessionId += accepted[Math.floor(Math.random() * accepted.length)];
  }
  return sessionId;
};


module.exports = {
  rtmpChunksCreate,
  generateSessionID,
};
