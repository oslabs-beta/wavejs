const RtmpPacket = require('./RtmpPacket');
const { config, state } = require('./_magic');
const rtmpActions = require('./rtmp_actions');
const AV = require('./av');
const utils = require('./rtmp_utils')
const session = require('./simpleOut');
const streamStorage = require('./simpleOut');

const readRtmpChunk = (data, bytesRead, bytes, stopCb) => {
  //initialize size, offset, timestamp
  let size = 0;
  let offset = 0;
  let extended_timestamp = 0;

  while (offset < bytes) {
    switch (state.parserState) {
      case config.parserStages.init:
        state.parserBytes = 1;
        //set initial parser header
        state.parserBuffer[0] = data[bytesRead + offset++];
        //check by byte to see if there is a basic head and it's length; if the first two conditions don't work, it doesn't have one and will skip the basic header step
        //if initialByte == 0 : basicBytes = 2, iB == 1: basicBytes = 3, else 1
        if (0 === (state.parserBuffer[0] & 0x3f)) {
          state.parserBasicBytes = 2;
        } else if (1 === (state.parserBuffer[0] & 0x3f)) {
          state.parserBasicBytes = 3;
        } else {
          state.parserBasicBytes = 1;
        }
        //move to header stage
        state.parserState = config.parserStages.basicHeader;
        break;
      case config.parserStages.basicHeader:
        //if there's a basic header, copy it into the buffer and move offset ahead
        while (state.parserBytes < state.parserBasicBytes && offset < bytes) {
          state.parserBuffer[state.parserBytes++] = data[bytesRead + offset++];
        }
        //if we have moved through the basic header, transition to message header section
        if (state.parserBytes >= state.parserBasicBytes) {
          state.parserState = config.parserStages.messageHeader;
        }
        break;
      case config.parserStages.messageHeader:
        // use bitwise operators to determine the size; if buffer at 0 is less then 64, do, select 0, if less than 128 select 1, etc. then add basic Bytes to size
        size =
          config.rtmpHeaderSize[state.parserBuffer[0] >> 6] +
          state.parserBasicBytes;
        //while offset is less than bytes and parser bytes are less than defined size
        while (state.parserBytes < size && offset < bytes) {
          state.parserBuffer[state.parserBytes++] = data[bytesRead + offset++];
        }
        //if the parserBytes is bigger than size, then the packet isw ready to be parsed and state can move to the timestamp
        if (state.parserBytes >= size) {
          rtmpPacketParse(stopCb); // start parsing the packet
          state.parserState = config.parserStages.extendedTimestamp;
        }
        break;
      case config.parserStages.extendedTimestamp:
        size =
          config.rtmpHeaderSize[state.parserPacket.header.fmt] +
          state.parserBasicBytes;
        //if the timestamp is now, increase size by 4
        if (state.parserPacket.header.timestamp === 0xffffff) size += 4;
        //read the timestamp into the parserBytes, increment offset
        while (state.parserBytes < size && offset < bytes) {
          state.parserBuffer[state.parserBytes++] = data[bytesRead + offset++];
        }
        //if parserbytes matches size, set extended timestamp, either using the now timestamp read into buffer or just the timestamp on the object
        if (state.parserBytes >= size) {
          if (state.parserPacket.header.timestamp === 0xffffff) {
            extended_timestamp = state.parserBuffer.readUInt32BE(
              config.rtmpHeaderSize[state.parserPacket.header.fmt] +
                state.parserBasicBytes
            );
          } else {
            extended_timestamp = state.parserPacket.header.timestamp;
          }

          //if there are no bytes in the parserPacket, set the clock to the timestamp if it's 11-byte or add to the clock if it's lower res
          if (state.parserPacket.bytes === 0) {
            if (config.chunkType.bytes11 === state.parserPacket.header.fmt) {
              state.parserPacket.clock = extended_timestamp;
            } else {
              state.parserPacket.clock += extended_timestamp;
            }
            rtmpPacketAlloc();
          }
          //move on to the payload stage
          state.parserState = config.parserStages.payload;
        }
        break;
      case config.parserStages.payload:
        //size is the less of the last input chunk (less than a typical input chunk) or the delta between the packet's header length and it's bytes
        size = Math.min(
          state.chunkSize.input -
            (state.parserPacket.bytes % state.chunkSize.input),
          state.parserPacket.header.length - state.parserPacket.bytes
        );
        //size is the least of that vs the delta of bytes and offset
        size = Math.min(size, bytes - offset);
        //if size is available, copy the packet into the object packet
        if (size > 0) {
          data.copy(
            state.parserPacket.payload,
            state.parserPacket.bytes,
            bytesRead + offset,
            bytesRead + offset + size
          );
        }
        //increment the offset and the object packet's size
        state.parserPacket.bytes += size;
        offset += size;

        //if the oibject packet now has the right length or more than right, reset the while loop to the beginning and handle the packet
        if (state.parserPacket.bytes >= state.parserPacket.header.length) {
          state.parserState = config.parserStages.init;
          state.parserPacket.bytes = 0;
          //if the packet has a clock later then now, don't handle and break the loop
          if (state.parserPacket.clock > 0xffffffff) {
            break;
          }
          //rtmpHandler()
          //if there is no remainder for remaining chunks, just reset the while loop
        } else if (0 === state.parserPacket.bytes % state.chunkSize.input) {
          state.parserState = config.parserStages.init;
        }
        break;
    }
  }
  state.ack.inSize += data.length;
  // if ack.inSize is bigger than 15 * 16^ 7, reset it
  if (state.ack.inSize >= 0xf0000000) {
    state.ack.inSize = 0;
    state.ack.inLast = 0;
  }
  // if ackSize is bigger than 0 and there's still more ack to send, set last Ack to the inAckSize and send it
  if (
    state.ack.size > 0 &&
    state.ack.inSize - state.ack.inLast >= state.ack.size
  ) {
    state.ack.inLast = state.ack.inSize;
    rtmpActions.sendACK(state.ack.inSize)
  }
};

const rtmpPacketParse = (stopCb) => {
  //produce a packet object from the current buffer
  let fmt = state.parserBuffer[0] >> 6;
  let cid = 0;
  //set CID based on basicBytes
  if (state.parserBasicBytes === 2) {
    cid = 64 + state.parserBuffer[1];
  } else if (state.parserBasicBytes === 3) {
    cid = (64 + state.parserBuffer[1] + state.parserBuffer[2]) << 8;
  } else {
    cid = state.parserBuffer[0] && 0x3f; //else there's no basic header
  }
  let hasPacket = state.recievedPackets.has(cid); // check if we have the packet
  //if we don't, make the packet using the above, else get it from received map
  if (!hasPacket) {
    state.parserPacket = RtmpPacket.create(fmt, cid);
    state.recievedPackets.set(cid, state.parserPacket);
  } else {
    state.parserPacket = state.recievedPackets.get(cid);
  }
  //ensure the headers are correct based on what received, even if we got it previously
  state.parserPacket.header.fmt = fmt;
  state.parserPacket.header.cid = cid;
  rtmpChunkMessageHeaderRead();
  // if parserpacket type is greater than the aggregate type, the packet is broken and process should terminate
  if (state.parserPacket.header.type > config.type.metadata) {
    console.log('rtmp packet parse error.', state.parserPacket);
    stopCb();
  }
};

const rtmpChunkMessageHeaderRead = () => {
  let offset = state.parserBasicBytes;

  //timestamp / delta
  //if at least 3 bytes, add delta and timestamp
  if (state.parserPacket.header.fmt <= config.chunkType.bytes3) {
    state.parserPacket.header.timestamp = state.parserBuffer.readUintBE(
      offset,
      3
    );
    //add 3 bytes to offset
    offset += 3;
  }
  //message length + type
  //if at least 7 bytes, add length and stream type
  if (state.parserPacket.header.fmt <= config.chunkType.bytes7) {
    state.parserPacket.header.length = state.parserBuffer.readUIntBE(offset, 3);
    state.parserPacket.header.type = state.parserBuffer[offset + 3];
    //add 4 bytes to offset
    offset += 4;
  }
  //if at least 11 bytes, add streamId
  if (state.parserPacket.header.fmt === config.chunkType.bytes11) {
    state.parserPacket.header.stream_id =
      state.parserBuffer.readUInt32LE(offset);
    offset += 4;
  }
  return offset; // why are we returning here?
};

const rtmpPacketAlloc = () => {
  //if the capacity is less then the length in the header, set payload to a buffer that matches the header length + 1024, and mark that down as the capacity
  if (state.parserPacket.capacity < state.parserPacket.header.length) {
    state.parserPacket.payload = Buffer.alloc(
      state.parserPacket.header.length + 1024
    );
    state.parserPacket.capacity = state.parserPacket.header.length + 1024;
  }
};


const rtmpHandler = () => {
  switch (state.parserPacket.header.type) {
    case config.type.setChunkSize:
    case config.type.abort:
    case config.type.acknowledgement:
    case config.type.acknowledgementSize:
    case config.type.setPeerBandwith:
      return 0 === rtmpControlHandler() ? -1 : 0;
    case config.type.event:
      return 0 === rtmpEventHandler() ? -1 : 0;
    case config.type.audio:
      //return this.rtmpAudioHandler();
    case config.type.video:
      //return this.rtmpVideoHandelr();
    case config.type.flexMessage:
    case config.type.invoke:
      //returm this.rtmpInvokeHandler();
    case config.type.flexStream: //AMF3
    case config.type.data: //AMF0
      //return this.rtmpDataHandler()
  }
};

const rtmpControlHander = (config, state) => {
  let payload = state.parserPacket.payload;
  switch (state.parserPacket.header.type) {
    case config.type.setChunkSize:
      state.chunkSize.input = payload.readUInt32BE();
      break;
    case config.type.abort:
      break;
    case config.type.acknowledgement:
      break;
    case config.type.acknowledgementSize:
      state.ack.size = payload.readUInt32BE();
      break;
    case config.type.setPeerBandwith:
      break;
  }
};

const rtmpEventHandler = () => {} //this is a void function in NMS, no idea why

const rtmpAudioHandler = (config, state) => {
  let payload = state.parserPacket.payload.slice(0, state.parserPacket.header.length);
  let sound_format = (payload[0] >> 4) & 0x0f;
  let sound_type = payload[0] & 0x01;
  let sound_size = (payload[0] >> 1) & 0x01;
  let sound_rate = (payload[0] >> 2) & 0x03;

  if (state.audioCodec === 0) {
    state.audioCodec = sound_format;
    state.audioCodecName = config.audio.codecName[sound_format];
    state.audioSamplerate = config.audio.soundRate[sound_rate];
    state.audioChannels = ++sound_type;
  }

  if (sound_format == 4) {
    //Nellymoser 16 kHz 
    state.audio.sampleRate = 16000;
  } else if (sound_format == 5 || sound_format == 7 || sound_format == 8) {
    //Nellymoser 8 kHz | G.711 A-law | G.711 mu-law
    state.audio.sampleRate = 8000;
  } else if (sound_format == 11) {
    // Speex
    state.audio.SampleRate = 16000;
  } else if (sound_format == 14) {
    //  MP3 8 kHz
    state.audio.SampleRate
  }

  if (sound_format != 10 && sound_format != 13) {
    
    //logging goes here
    // Logger.log(
    //   `[rtmp publish] Handle audio. id=${this.id} streamPath=${this.publishStreamPath
    //   } sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${this.audioCodecName} ${this.audioSamplerate} ${this.audioChannels
    //   }ch`
    // );
  }

//AAC, OPUS
if ((sound_format == 10 || sound_format == 13) && payload[1] == 0) {
  //cache aac sequence header
  state.isFirstAudioReceived = true;
  state.audio.aacSequenceHeader = Buffer.alloc(payload.length);
  payload.copy(state.audio.aacSequenceHeader);
  if (sound_format == 10) {
    let info = AV.readAACSpecificConfig(state.audio.aacSequenceHeader);
    state.audio.profileName = AV.getAACProfileName(info);
    state.audio.sampleRate = info.sample_rate;
    state.audio.channels = info.channels;
  } else {
    state.audio.sampleRate = 48000;
    state.audio.channels = payload[11];
  }
  //logging goes here
  // Logger.log(
  //   `[rtmp publish] Handle audio. id=${this.id} streamPath=${this.publishStreamPath
  //   } sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${this.audioCodecName} ${this.audioSamplerate} ${this.audioChannels
  //   }ch`
  // );
}

let packet = RtmpPacket.create();
packet.header.fmt = config.chunkType.bytes11;
packet.header.cid = config.channel.audio;
packet.header.type = config.type.audio;
packet.payload = payload;
packet.header.length = packet.payload.length;
packet.header.timestamp = state.parserPacket.clock;
let rtmpChunks = utils.rtmpChunksCreate(packet);
// IMPORTANT: do I need to make an FLV session here??
//let flvTag = NodeFlvSession.createFlvTag(packet);

//cache gop
if (state.rtmpGopCacheQueue != null) {
  if (state.audio.aacSequenceHeader != null && payload[1] === 0) {
    //skip aac sequence header
  } else {
    state.rtmpGopCacheQueue.add(rtmpChunks);
    //IMPORTANT: How important is FLV sessions to this?
    //this.flvGopCacheQueue.add(flvTag);
  }
}
if (state.streamSession === null) {
    state.streamStorage = streamStorage.initializeStream()
    rtmpChunks.writeUInt32LE(streamId, 8); //this needs to come from the socket
    streamStorage.writeStreamAudio(rtmpChunks)
}
/* HANDLE PLAYERS
for (let playerId of this.players) {
  let playerSession = context.sessions.get(playerId);

  if (playerSession.numPlayCache === 0) {
    playerSession.res.cork();
  }

  if (playerSession instanceof NodeRtmpSession) {
    if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause && playerSession.isReceiveAudio) {
      rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
      playerSession.res.write(rtmpChunks);
    }
  } else if (playerSession instanceof NodeFlvSession) {
    playerSession.res.write(flvTag, null, e => {
      //websocket will throw a error if not set the cb when closed
    });
  }

  playerSession.numPlayCache++;

  if (playerSession.numPlayCache === 10) {
    process.nextTick(() => playerSession.res.uncork());
    playerSession.numPlayCache = 0;
  }

}*/
};