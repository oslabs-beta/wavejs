const RtmpPacket = require('./RtmpPacket');
const { config, state } = require('./_magic');
const rtmpActions = require('./rtmp_actions');
const AV = require('./av');
const AMF = require('./node_core_amf');
const utils = require('./rtmp_utils');
const QueryString = require('node:querystring');
const streamStorage = require('./global')

let streamId = 'test'

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
      return rtmpAudioHandler();
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

const rtmpControlHandler = (config, state) => {
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
  //our stream handler
  if (streamStorage.get(streamId) === undefined) {
    streamStorage.initializeStream(streamId) //IMPORTANT this has to come 
  }
  let streamStore = streamStorage.retrieveStream(streamId)
  if (streamStore.numPlayCache === 0) {
    streamStore.streamData.cork();
  }
  rtmpChunks.writeUInt32LE(streamId, 8); //this needs to come from the socket
  streamStore.streamData.write(rtmpChunks);
  
  streamStore.numPlayCache++;
  
  if (streamStore.numPlayCache === 10) {
    process.nextTick(()=> streamStore.StreamData.uncork());
    streamStore.numPlayCache = 0;
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

const rtmpVideoHandler = (config, state) => {
  let payload = state.parserPacket.payload.slice(0, state.parserPacket.header.length);
  let isExHeader = (payload[0] >> 4 & 0b1000) !== 0;
  let frame_type = payload[0] >> 4 & 0b0111;
  let codec_id = payload[0] & 0x0f;
  let packetType = payload[0] & 0x0f;
  if (isExHeader) {
    if (packetType == config.packetType.metadata) {
      //empty in nms
    }
    else if (packetType == config.packetType.sequenceEnd) {
      //empty in nms
    }
    let FourCC = payload.subarray(1, 5);
    if (FourCC.compare(config.fourCC.HEVC) == 0) {
      codec_id = 12;
      if (packetType == config.packetType.sequenceStart) {
        payload[0] = 0x1c;
        payload[1] = 0;
        payload[2] = 0;
        payload[3] = 0;
        payload[4] = 0;
      } else if (packetType == config.packetType.codedFrames || packetType == config.packetType.codedFramesX) {
        if (packetType == config.packetType.codedFrames) {
          payload = payload.subarray(3);
        } else {
          payload[2] = 0;
          payload[3] = 0;
          payload[4] = 0;
        }
        payload[0] = frame_type << 4 | 0x0c;
        payload[1] = 1;
      }
    } else if (FourCC.compare(config.fourCC.AV1) == 0) {
      codec_id = 13;
      if (packetType == config.packetType.sequenceStart) {
        payload[0] = 0x1d;
        payload[1] = 0;
        payload[2] = 0;
        payload[3] = 0;
        payload[4] = 0;
        // Logger.log("PacketTypeSequenceStart", payload.subarray(0, 16));
      } else if (packetType == config.packetType.MPEG2TSSequenceStart) {
        // Logger.log("PacketTypeMPEG2TSSequenceStart", payload.subarray(0, 16));
      } else if (packetType == config.packetType.codedFrames) {
        // Logger.log("PacketTypeCodedFrames", payload.subarray(0, 16));
        payload[0] = frame_type << 4 | 0x0d;
        payload[1] = 1;
        payload[2] = 0;
        payload[3] = 0;
        payload[4] = 0;
      }
    } else {
      //Logger.log(`unsupported extension header`);
      //logging goes here
      return;
    }
  }

  if (state.video.fps === 0) {
    if (state.video.count++ === 0) {
      setTimeout(() => {
        state.video.fps = Math.ceil(state.video.count / 5);
      }, 5000);
    }
  }

  if (codec_id == 7 || codec_id == 12 || codec_id == 13) {
    //cache avc sequence header
    if (frame_type == 1 && payload[1] == 0) {
      state.video.avcSequenceHeader = Buffer.alloc(payload.length);
      payload.copy(state.video.avcSequenceHeader);
      let info = AV.readAVCSpecificConfig(state.avcSequenceHeader);
      state.video.width = info.width;
      state.video.height = info.height;
      state.video.profileName = AV.getAVCProfileName(info);
      state.video.level = info.level;
      //Logger.log(`[rtmp publish] avc sequence header`,this.avcSequenceHeader);
    }
  }

  if (state.video.codec == 0) {
    state.video.codec = codec_id;
    state.video.codecName = config.video.codecName[codec_id];
    //logging goes here
    // Logger.log(
    //   `[rtmp publish] Handle video. id=${this.id} streamPath=${this.publishStreamPath} frame_type=${frame_type} codec_id=${codec_id} codec_name=${this.videoCodecName} ${this.videoWidth
    //   }x${this.videoHeight}`
    // );
  }

  let packet = RtmpPacket.create();
  packet.header.fmt = config.chunkType.bytes11;
  packet.header.cid = config.channel.video;
  packet.header.type = config.type.video;
  packet.payload = payload;
  packet.header.length = packet.payload.length;
  packet.header.timestamp = state.parserPacket.clock;
  let rtmpChunks = utils.rtmpChunksCreate(packet);
  //let flvTag = NodeFlvSession.createFlvTag(packet);

  //cache gop
  if (state.rtmpGopCacheQueue != null) {
    if (frame_type == 1) {
      state.rtmpGopCacheQueue.clear();
      state.flvGopCacheQueue.clear();
    }
    if ((codec_id == 7 || codec_id == 12 || codec_id == 13) && frame_type == 1 && payload[1] == 0) {
      //skip avc sequence header
    } else {
      state.rtmpGopCacheQueue.add(rtmpChunks);
      //this.flvGopCacheQueue.add(flvTag);
    }
  }
  //our stream handler
  if (streamStorage.get(streamId) === undefined) {
    streamStorage.initializeStream(streamId) //IMPORTANT this has to come first
  }
  let streamStore = streamStorage.retrieveStream(streamId)
  if (streamStore.numPlayCache === 0) {
    streamStore.streamData.cork();
  }
  rtmpChunks.writeUInt32LE(streamId, 8); //this needs to come from the socket
  streamStore.streamData.write(rtmpChunks);
  
  streamStore.numPlayCache++;
  
  if (streamStore.numPlayCache === 10) {
    process.nextTick(()=> streamStore.StreamData.uncork());
    streamStore.numPlayCache = 0;
  } 

  // // Logger.log(rtmpChunks);
  // for (let playerId of this.players) {
  //   let playerSession = context.sessions.get(playerId);

  //   if (playerSession.numPlayCache === 0) {
  //     playerSession.res.cork();
  //   }

  //   if (playerSession instanceof NodeRtmpSession) {
  //     if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause && playerSession.isReceiveVideo) {
  //       rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
  //       playerSession.res.write(rtmpChunks);
  //     }
  //   } else if (playerSession instanceof NodeFlvSession) {
  //     playerSession.res.write(flvTag, null, e => {
  //       //websocket will throw a error if not set the cb when closed
  //     });
  //   }

  //   playerSession.numPlayCache++;

  //   if (playerSession.numPlayCache === 10) {
  //     process.nextTick(() => playerSession.res.uncork());
  //     playerSession.numPlayCache = 0;
  //   }
  // }
};

const rtmpDataHandler = (config, state) => {
  let offset = state.parserPacket.header.type === config.type.flexStream ? 1 : 0;
  let payload = state.parserPacket.payload.slice(offset, state.parserPacket.header.length);
  let dataMessage = AMF.decodeAmf0Data(payload);
  switch (dataMessage.cmd) {
    case '@setDataFrame':
      if (dataMessage.dataObj) {
        state.audio.sampleRate = dataMessage.dataObj.audiosamplerate;
        state.audio.channels = dataMessage.dataObj.stereo ? 2 : 1;
        state.video.width = dataMessage.dataObj.width;
        state.video.height = dataMessage.dataObj.height;
        state.video.fps = dataMessage.dataObj.framerate;
      }

      let opt = {
        cmd: 'onMetaData',
        dataObj: dataMessage.dataObj
      };
      state.metaData = AMF.encodeAmf0Data(opt);

      let packet = RtmpPacket.create();
      packet.header.fmt = config.chunkType.bytes11;
      packet.header.cid = config.channel.data;
      packet.header.type = config.type.data;
      packet.payload = state.metaData;
      packet.header.length = packet.payload.length;
      let rtmpChunks = utils.rtmpChunksCreate(packet);
      //let flvTag = NodeFlvSession.createFlvTag(packet);

      if (streamStorage.get(streamId) === undefined) {
        streamStorage.initializeStream(streamId) //IMPORTANT this has to come first
      }
      let streamStore = streamStorage.retrieveStream(streamId)
      rtmpChunks.writeUInt32LE(streamId, 8); //this needs to come from the socket
      streamStore.streamData.write(rtmpChunks);
  

      // for (let playerId of this.players) {
      //   let playerSession = context.sessions.get(playerId);
      //   if (playerSession instanceof NodeRtmpSession) {
      //     if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause) {
      //       rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
      //       playerSession.socket.write(rtmpChunks);
      //     }
      //   } else if (playerSession instanceof NodeFlvSession) {
      //     playerSession.res.write(flvTag, null, e => {
      //       //websocket will throw a error if not set the cb when closed
      //     });
      //   }
      // }
      break;
  }
}

const rtmpInvokeHandler = (config, state) => {
  let offset = state.parserPacket.header.type === config.type.flexMessage ? 1 : 0;
  let payload = state.parserPacket.payload.slice(offset, state.parserPacket.header.length);
  let invokeMessage = AMF.decodeAmf0Cmd(payload);
  // Logger.log(invokeMessage);
  switch (invokeMessage.cmd) {
    case 'connect':  //y
      onConnect(invokeMessage, config, state);
      break;
    case 'releaseStream':
      break;
    case 'FCPublish':
      break;
    case 'createStream':  //y
      onCreateStream(invokeMessage, config, state);
      break;
    case 'publish':  //y
      onPublish(invokeMessage);
      break;
    case 'play':
    //play is disabled  
    // this.onPlay(invokeMessage);
      break;
    case 'pause':
      //pause was disabled
      //this.onPause(invokeMessage);
      break;
    case 'FCUnpublish':
      break;
    case 'deleteStream':  //y
      onDeleteStream(invokeMessage, config, state);
      break;
    case 'closeStream':  //y
      onCloseStream(config, state);
      break;
    case 'receiveAudio':  //y
      onReceiveAudio(invokeMessage, config, state);
      break;
    case 'receiveVideo':  //y
      onReceiveVideo(invokeMessage, config, state);
      break;
  }
}

const onConnect = (invokeMessage, state, config) => {
  invokeMessage.cmdObj.app = invokeMessage.cmdObj.app.replace('/', ''); //fix jwplayer
  //context.nodeEvent.emit('preConnect', this.id, invokeMessage.cmdObj);
  if (!state.status.isStarting) {
    return;
  }
  //state
  state.connect.cmdObj = invokeMessage.cmdObj;
  state.connect.appname = invokeMessage.cmdObj.app;
  state.connect.objectEncoding = invokeMessage.cmdObj.objectEncoding != null ? invokeMessage.cmdObj.objectEncoding : 0;
  state.connect.time = new Date();
  state.connect.startTimestamp = Date.now();
  state.connect.bitrateCache = {
    intervalMs: 1000,
    last_update: state.connect.startTimestamp,
    bytes: 0,
  };

  //functions
  state.connect.pingInterval = setInterval(() => {
    rtmpActions.sendPingRequest(config, state, state.socket);
  }, state.connect.pingTime);
  rtmpActions.sendWindowACK(5000000, state.socket);
  rtmpActions.setPeerBandwidth(5000000, 2, state.socket);
  rtmpActions.setChunkSize(config.chunkSize.output, state.socket);
  rtmpActions.respondConnect(invokeMessage.transId, state, state.socket);
  
  //logging goes here
  // Logger.log(`[rtmp connect] id=${this.id} ip=${this.ip} app=${this.appname} args=${JSON.stringify(invokeMessage.cmdObj)}`);
  // context.nodeEvent.emit('postConnect', this.id, invokeMessage.cmdObj);
}

const onCreateStream = (invokeMessage, config, state) => {
  rtmpActions.respondCreateStream(invokeMessage.transId, config, state, state.socket);
};

const onPublish = (invokeMessage, config, state) => {
  if (typeof invokeMessage.streamName !== 'string') {
    return;
  }
  state.streams.publish.path = '/' + state.connect.appname + '/' + invokeMessage.streamName.split('?')[0];
  state.streams.publish.args = QueryString.parse(invokeMessage.streamName.split('?')[1]);
  state.streams.publish.id = state.parserPacket.header.stream_id;
  // context.nodeEvent.emit('prePublish', this.id, this.publishStreamPath, this.publishArgs);
  if (!state.status.isStarting) {
    return;
  }
  
  // if (this.config.auth && this.config.auth.publish && !this.isLocal) {
  //   let results = NodeCoreUtils.verifyAuth(this.publishArgs.sign, this.publishStreamPath, this.config.auth.secret);
  //   if (!results) {
  //     Logger.log(`[rtmp publish] Unauthorized. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId} sign=${this.publishArgs.sign} `);
  //     this.sendStatusMessage(this.publishStreamId, 'error', 'NetStream.publish.Unauthorized', 'Authorization required.');
  //     return;
  //   }
  // }

  if (streamStorage.publishers.has(state.streams.publish.path)) {
    reject(config, state);
    //logger goes here
    // Logger.log(`[rtmp publish] Already has a stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
    // this.sendStatusMessage(this.publishStreamId, 'error', 'NetStream.Publish.BadName', 'Stream already publishing');
  } else if (state.status.isPublishing) {
    //Logger goes here
    // Logger.log(`[rtmp publish] NetConnection is publishing. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
    // this.sendStatusMessage(this.publishStreamId, 'error', 'NetStream.Publish.BadConnection', 'Connection already publishing');
  } else {
    //loggert goes here
    // Logger.log(`[rtmp publish] New stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
    streamStorage.publishers.set(state.streams.publish.path, state.id);
    state.status.isPublishing = true;

    rtmpActions.sendStatusMessage(state.streams.publish.id, 'status', 'NetStream.Publish.Start', `${state.streams.publish.path} is now published.`);
    // for (let idlePlayerId of context.idlePlayers) {
    //   let idlePlayer = context.sessions.get(idlePlayerId);
    //   if (idlePlayer && idlePlayer.playStreamPath === this.publishStreamPath) {
    //     idlePlayer.onStartPlay();
    //     context.idlePlayers.delete(idlePlayerId);
    //   }
    // }
    // context.nodeEvent.emit('postPublish', this.id, this.publishStreamPath, this.publishArgs);
  }
}

// onPlay(invokeMessage) {
//   if (typeof invokeMessage.streamName !== 'string') {
//     return;
//   }
//   this.playStreamPath = '/' + this.appname + '/' + invokeMessage.streamName.split('?')[0];
//   this.playArgs = QueryString.parse(invokeMessage.streamName.split('?')[1]);
//   this.playStreamId = this.parserPacket.header.stream_id;
//   context.nodeEvent.emit('prePlay', this.id, this.playStreamPath, this.playArgs);

//   if (!this.isStarting) {
//     return;
//   }

//   if (this.config.auth && this.config.auth.play && !this.isLocal) {
//     let results = NodeCoreUtils.verifyAuth(this.playArgs.sign, this.playStreamPath, this.config.auth.secret);
//     if (!results) {
//       Logger.log(`[rtmp play] Unauthorized. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} sign=${this.playArgs.sign}`);
//       this.sendStatusMessage(this.playStreamId, 'error', 'NetStream.play.Unauthorized', 'Authorization required.');
//       return;
//     }
//   }

//   if (this.isPlaying) {
//     Logger.log(`[rtmp play] NetConnection is playing. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
//     this.sendStatusMessage(this.playStreamId, 'error', 'NetStream.Play.BadConnection', 'Connection already playing');
//   } else {
//     this.respondPlay();
//   }

//   if (context.publishers.has(this.playStreamPath)) {
//     this.onStartPlay();
//   } else {
//     Logger.log(`[rtmp play] Stream not found. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId}`);
//     this.isIdling = true;
//     context.idlePlayers.add(this.id);
//   }
// }

// onStartPlay() {
//   let publisherId = context.publishers.get(this.playStreamPath);
//   let publisher = context.sessions.get(publisherId);
//   let players = publisher.players;
//   players.add(this.id);

//   if (publisher.metaData != null) {
//     let packet = RtmpPacket.create();
//     packet.header.fmt = RTMP_CHUNK_TYPE_0;
//     packet.header.cid = RTMP_CHANNEL_DATA;
//     packet.header.type = RTMP_TYPE_DATA;
//     packet.payload = publisher.metaData;
//     packet.header.length = packet.payload.length;
//     packet.header.stream_id = this.playStreamId;
//     let chunks = this.rtmpChunksCreate(packet);
//     this.socket.write(chunks);
//   }

//   if (publisher.audioCodec === 10 || publisher.audioCodec === 13) {
//     let packet = RtmpPacket.create();
//     packet.header.fmt = RTMP_CHUNK_TYPE_0;
//     packet.header.cid = RTMP_CHANNEL_AUDIO;
//     packet.header.type = RTMP_TYPE_AUDIO;
//     packet.payload = publisher.aacSequenceHeader;
//     packet.header.length = packet.payload.length;
//     packet.header.stream_id = this.playStreamId;
//     let chunks = this.rtmpChunksCreate(packet);
//     this.socket.write(chunks);
//   }

//   if (publisher.videoCodec === 7 || publisher.videoCodec === 12 || publisher.videoCodec === 13) {
//     let packet = RtmpPacket.create();
//     packet.header.fmt = RTMP_CHUNK_TYPE_0;
//     packet.header.cid = RTMP_CHANNEL_VIDEO;
//     packet.header.type = RTMP_TYPE_VIDEO;
//     packet.payload = publisher.avcSequenceHeader;
//     packet.header.length = packet.payload.length;
//     packet.header.stream_id = this.playStreamId;
//     let chunks = this.rtmpChunksCreate(packet);
//     this.socket.write(chunks);
//   }

//   if (publisher.rtmpGopCacheQueue != null) {
//     for (let chunks of publisher.rtmpGopCacheQueue) {
//       chunks.writeUInt32LE(this.playStreamId, 8);
//       this.socket.write(chunks);
//     }
//   }

//   this.isIdling = false;
//   this.isPlaying = true;
//   context.nodeEvent.emit('postPlay', this.id, this.playStreamPath, this.playArgs);
//   Logger.log(`[rtmp play] Join stream. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
// }

// onPause(invokeMessage) {
//   this.isPause = invokeMessage.pause;
//   let c = this.isPause ? 'NetStream.Pause.Notify' : 'NetStream.Unpause.Notify';
//   let d = this.isPause ? 'Paused live' : 'Unpaused live';
//   Logger.log(`[rtmp play] ${d} stream. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
//   if (!this.isPause) {
//     this.sendStreamStatus(STREAM_BEGIN, this.playStreamId);
//     if (context.publishers.has(this.playStreamPath)) {
//       //fix ckplayer
//       let publisherId = context.publishers.get(this.playStreamPath);
//       let publisher = context.sessions.get(publisherId);
//       if (publisher.audioCodec === 10 || publisher.audioCodec === 13) {
//         let packet = RtmpPacket.create();
//         packet.header.fmt = RTMP_CHUNK_TYPE_0;
//         packet.header.cid = RTMP_CHANNEL_AUDIO;
//         packet.header.type = RTMP_TYPE_AUDIO;
//         packet.payload = publisher.aacSequenceHeader;
//         packet.header.length = packet.payload.length;
//         packet.header.stream_id = this.playStreamId;
//         packet.header.timestamp = publisher.parserPacket.clock; // ?? 0 or clock
//         let chunks = this.rtmpChunksCreate(packet);
//         this.socket.write(chunks);
//       }
//       if (publisher.videoCodec === 7 || publisher.videoCodec === 12 || publisher.videoCodec === 13) {
//         let packet = RtmpPacket.create();
//         packet.header.fmt = RTMP_CHUNK_TYPE_0;
//         packet.header.cid = RTMP_CHANNEL_VIDEO;
//         packet.header.type = RTMP_TYPE_VIDEO;
//         packet.payload = publisher.avcSequenceHeader;
//         packet.header.length = packet.payload.length;
//         packet.header.stream_id = this.playStreamId;
//         packet.header.timestamp = publisher.parserPacket.clock; // ?? 0 or clock
//         let chunks = this.rtmpChunksCreate(packet);
//         this.socket.write(chunks);
//       }
//     }
//   } else {
//     this.sendStreamStatus(STREAM_EOF, this.playStreamId);
//   }
//   this.sendStatusMessage(this.playStreamId, c, d);
// }

const onReceiveAudio = (invokeMessage, config, state) => {
  state.status.isReceiveAudio = invokeMessage.bool;
  //logger goes here
  //Logger.log(`[rtmp play] receiveAudio=${this.isReceiveAudio} id=${this.id} `);
}

const onReceiveVideo = (invokeMessage, config, state) => {
  state.status.isReceiveVideo = invokeMessage.bool;
  //Logger goes here
  //Logger.log(`[rtmp play] receiveVideo=${this.isReceiveVideo} id=${this.id} `);
}

const onCloseStream = (config, state) => {
  //red5-publisher
  let closeStream = { streamId: state.parserPacket.header.stream_id };
  onDeleteStream(closeStream, config, state);
}

const onDeleteStream = (invokeMessage, config, state) => {
  // play focused 
  //if (invokeMessage.streamId == state.streams.play.id) {
  //   if (state.status.isIdling) {
  //     context.idlePlayers.delete(this.id);
  //     state.status.isIdling = false;
  //   } else {
  //     let publisherId = context.publishers.get(this.playStreamPath);
  //     if (publisherId != null) {
  //       context.sessions.get(publisherId).players.delete(this.id);
  //     }
  //     context.nodeEvent.emit('donePlay', this.id, this.playStreamPath, this.playArgs);
  //     this.isPlaying = false;
  //   }
  //   Logger.log(`[rtmp play] Close stream. id=${this.id} streamPath=${this.playStreamPath} streamId=${this.playStreamId}`);
  //   if (this.isStarting) {
  //     this.sendStatusMessage(this.playStreamId, 'status', 'NetStream.Play.Stop', 'Stopped playing stream.');
  //   }
  //   this.playStreamId = 0;
  //   this.playStreamPath = '';
  // }

  if (invokeMessage.streamId == state.streams.publish.id) {
    if (state.status.isPublishing) {
      //logging goes here
      // Logger.log(`[rtmp publish] Close stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
      // context.nodeEvent.emit('donePublish', this.id, this.publishStreamPath, this.publishArgs);
      if (state.status.isStarting) {
        rtmpActions.sendStatusMessage(state.streams.publish.id, 'status', 'NetStream.Unpublish.Success', `${state.streams.publish.path} is now unpublished.`);
      }

      // for (let playerId of this.players) {
      //   let playerSession = context.sessions.get(playerId);
      //   if (playerSession instanceof NodeRtmpSession) {
      //     playerSession.sendStatusMessage(playerSession.playStreamId, 'status', 'NetStream.Play.UnpublishNotify', 'stream is now unpublished.');
      //     playerSession.flush();
      //   } else {
      //     playerSession.stop();
      //   }
      // }

      // //let the players to idlePlayers
      // for (let playerId of this.players) {
      //   let playerSession = context.sessions.get(playerId);
      //   context.idlePlayers.add(playerId);
      //   playerSession.isPlaying = false;
      //   playerSession.isIdling = true;
      //   if (playerSession instanceof NodeRtmpSession) {
      //     playerSession.sendStreamStatus(STREAM_EOF, playerSession.playStreamId);
      //   }
      // }

      streamStorage.publishers.delete(state.streams.publish.path);
      if (state.rtmpGopCacheQueue) {
        state.rtmpGopCacheQueue.clear();
      }
      
      state.status.isPublishing = false;
    }
    state.stream.publish.id = 0;
    state.stream.publish.path = '';
  }
}


const stop = (config, state) => {
  if (state.status.isStarting) {
    state.status.isStarting = false;

    if (state.streams.play.id > 0) {
      onDeleteStream({ streamId: state.streams.play.id }, config, state);
    }

    if (state.streams.publish.id > 0) {
      onDeleteStream({ streamId: state.streams.publish.id }, config, state);
    }

    if (state.pingInterval != null) {
      clearInterval(state.pingInterval);
      state.pingInterval = null;
    }
    //logger goes here
    //Logger.log(`[rtmp disconnect] id=${this.id}`);
    
    state.connect.cmdObj.bytesWritten = state.socket.bytesWritten;
    state.connect.cmdObj.bytesRead = state.socket.bytesRead;
    //context.nodeEvent.emit('doneConnect', this.id, this.connectCmdObj);

    sessionStorage.sessions.delete(this.id);
    state.socket.destroy();
  }
}

const reject = (config, state) => {
  //logger goes here
  //Logger.log(`[rtmp reject] id=${this.id}`);
  stop(config, state);
}