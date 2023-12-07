const QueryString = require('node:querystring');

const AV = require('./av');
const AMF = require('./node_core_amf');
const RtmpPacket = require('./RtmpPacket');
const Handshake = require('./node_rtmp_handshake');

const rtmpActions = require('./rtmp_actions');
const utils = require('../utils');
const Logger = require('../logger');
const streamStorage = require('../session');

/* CORE EVENT HANDLER */

const handleRTMPHandshake = (config, state, streamStorage, data) => {
  let bytes = data.length;
  let bytesRead = 0; //what is this // p
  let bytesToProcess = 0; // what is this // n
  while (bytes > 0) {
    switch (state.handshake.handshakeStage) {
      case config.handshakeStages.uninit:
        // Logger.debug(`[rtmp handshake] uninit`)
        //start the handshake, get C0 from client
        state.handshake.handshakeStage = config.handshakeStages.c1_to_s0_s1_s2;
        state.handshake.handshakeBytes = 0;
        bytes -= 1;
        bytesRead += 1;
        break;
      case config.handshakeStages.c1_to_s0_s1_s2:
        // Logger.debug(`[rtmp handshake] c1 to s2`)
        //get the 1536 rqndom bytes and store them (c1)
        //set number of bytes to process
        bytesToProcess = config.handshake_size - state.handshake.handshakeBytes;
        //if bytesToProcess  is lt-eq bytes, keep bytes as is, otherwise ensure it's the size of bytes
        bytesToProcess = bytesToProcess <= bytes ? bytesToProcess : bytes;
        //copy the random bites
        data.copy(
          state.handshake.handshakePayload,
          state.handshake.handshakeBytes,
          bytesRead,
          bytesRead + bytesToProcess
        );
        //increment handshake bytes and bytesRead by the amount processed, decrementing bytes remaining
        state.handshake.handshakeBytes += bytesToProcess;
        bytesRead += bytesToProcess;
        bytes -= bytesToProcess;
        //if this is the full handshake, move to rtmp_handshake_1 and send S0, S1, and S2, reset handshakeBytes
        if (state.handshake.handshakeBytes === config.handshake_size) {
          state.handshake.handshakeStage =
            config.handshakeStages.c2_to_connection;
          state.handshake.handshakeBytes = 0;
          //Build s0_s1_s2
          let s0_s1_s2 = Handshake.generateS0S1S2(
            state.handshake.handshakePayload
          );
          state.socket.write(s0_s1_s2);
        }
        break;
      case config.handshakeStages.c2_to_connection:
        // Logger.debug(`[rtmp handshake] c2 to connection`)
        //manage C2 (the 1536 bytes the client is sending over to confirm they're legit)
        //set number of bytes to process
        bytesToProcess = config.handshake_size - state.handshake.handshakeBytes;
        //if bytesToProcess  is lt-eq bytes, keep bytes as is, otherwise ensure it's the size of bytes
        bytesToProcess = bytesToProcess <= bytes ? bytesToProcess : bytes;
        data.copy(
          state.handshake.handshakePayload,
          state.handshake.handshakeBytes,
          bytesRead,
          bytesToProcess
        );
        //increment handshake bytes and bytesRead by the amount processed, decrementing bytes remaining
        state.handshake.handshakeBytes += bytesToProcess;
        bytesRead += bytesToProcess;
        bytes -= bytesToProcess;
        //if the sent handshake matches the number of bytes we sent, then C2 is valid and move to state 2 (connection)
        if (state.handshake.handshakeBytes === config.handshake_size) {
          state.handshake.handshakeStage =
            config.handshakeStages.begin_processing;
          state.handshake.handshakeBytes = 0;
          state.handshake.handshakePayload = null;
        }
        break;
      case config.handshakeStages.begin_processing:
      default:
        //connection has occured, we're away at the races
        //read chunk
        // Logger.debug(`[rtmp handshake] begin processing`)
        return readRtmpChunk(
          config,
          state,
          streamStorage,
          data,
          bytesRead,
          bytes
        );
    }
  }
};

/* RTMP RESOURCES */

const readRtmpChunk = (
  config,
  state,
  streamStorage,
  data,
  bytesRead,
  bytes
) => {
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
          rtmpPacketParse(config, state); // start parsing the packet
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
            rtmpPacketAlloc(config, state);
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
          rtmpHandler(config, state, streamStorage);
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
    rtmpActions.sendACK(config, state, state.ack.inSize);
  }
};

const rtmpPacketParse = (config, state) => {
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
  rtmpChunkMessageHeaderRead(config, state);
  // if parserpacket type is greater than the aggregate type, the packet is broken and process should terminate
  if (state.parserPacket.header.type > config.type.metadata) {
    console.log('rtmp packet parse error.', state.parserPacket);
    stop(config, state, streamStorage);
  }
};

const rtmpChunkMessageHeaderRead = (config, state) => {
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

const rtmpPacketAlloc = (config, state) => {
  //if the capacity is less then the length in the header, set payload to a buffer that matches the header length + 1024, and mark that down as the capacity
  if (state.parserPacket.capacity < state.parserPacket.header.length) {
    state.parserPacket.payload = Buffer.alloc(
      state.parserPacket.header.length + 1024
    );
    state.parserPacket.capacity = state.parserPacket.header.length + 1024;
  }
};

/* RTMP CONTROL FLOW */

const rtmpHandler = (config, state, streamStorage) => {
  switch (state.parserPacket.header.type) {
    case config.type.setChunkSize:
    case config.type.abort:
    case config.type.acknowledgement:
    case config.type.acknowledgementSize:
    case config.type.setPeerBandwith:
      return 0 === rtmpControlHandler(config, state) ? -1 : 0;
    case config.type.event:
      return 0 === rtmpEventHandler(config, state) ? -1 : 0;
    case config.type.audio:
      return rtmpAudioHandler(config, state, streamStorage);
    case config.type.video:
      return rtmpVideoHandler(config, state, streamStorage);
    case config.type.flexMessage:
    case config.type.invoke:
      return rtmpInvokeHandler(config, state, streamStorage);
    case config.type.flexStream: //AMF3
    case config.type.data: //AMF0
      return rtmpDataHandler(config, state, streamStorage);
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

const rtmpEventHandler = () => {}; //this is a void function in NMS, no idea why

const rtmpAudioHandler = (config, state, streamStorage) => {
  let payload = state.parserPacket.payload.slice(
    0,
    state.parserPacket.header.length
  );
  let sound_format = (payload[0] >> 4) & 0x0f;
  let sound_type = payload[0] & 0x01;
  let sound_size = (payload[0] >> 1) & 0x01;
  let sound_rate = (payload[0] >> 2) & 0x03;

  if (state.audio.codec === 0) {
    state.audio.codec = sound_format;
    state.audio.codecName = config.audio.codecName[sound_format];
    state.audio.sampleRate = config.audio.soundRate[sound_rate];
    state.audio.channels = ++sound_type;
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
    state.audio.SampleRate;
  }

  if (sound_format != 10 && sound_format != 13) {
    //logging goes here
    Logger.info(
      `[rtmp publish] audio received. id=${state.id} streamPath=${state.streams.publish.path} sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${state.audio.codecName} ${state.audio.sampleRate} ${state.audio.channels}ch`
    );
    streamStorage.events.emit('audio', {
      id: state.id,
      stream_path: state.streams.publish.path,
      sound_format,
      sound_size,
      sound_rate,
      codec_name: state.audio.codecName,
      sample_rate: state.audio.sampleRate,
      channels: state.audio.channels,
    });
  }

  //AAC, OPUS
  if ((sound_format == 10 || sound_format == 13) && payload[1] == 0) {
    //cache aac sequence header
    state.isFirstAudioReceived = true;
    state.audio.aacSequenceHeader = Buffer.alloc(payload.length);
    payload.copy(state.audio.aacSequenceHeader);
    if (sound_format == 10) {
      //Logger.debug(state.audio)
      let info = AV.readAACSpecificConfig(
        config,
        state,
        state.audio.aacSequenceHeader
      );
      state.audio.profileName = AV.getAACProfileName(info);
      state.audio.sampleRate = info.sample_rate;
      state.audio.channels = info.channels;
    } else {
      state.audio.sampleRate = 48000;
      state.audio.channels = payload[11];
    }
    //logging goes here
    Logger.info(
      `[rtmp publish] audio received. id=${state.id} streamPath=${state.streams.publish.path} sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${state.audio.codecName} ${state.audio.sampleRate} ${state.audio.channels}ch`
    );
    streamStorage.events.emit('audio', {
      id: state.id,
      stream_path: state.streams.publish.path,
      sound_format,
      sound_size,
      sound_rate,
      codec_name: state.audio.codecName,
      sample_rate: state.audio.sampleRate,
      channels: state.audio.channels,
    });
  }
};

const rtmpVideoHandler = (config, state, streamStorage) => {
  let payload = state.parserPacket.payload.slice(
    0,
    state.parserPacket.header.length
  );
  let isExHeader = ((payload[0] >> 4) & 0b1000) !== 0;
  let frame_type = (payload[0] >> 4) & 0b0111;
  let codec_id = payload[0] & 0x0f;
  let packetType = payload[0] & 0x0f;
  if (isExHeader) {
    if (packetType == config.packetType.metadata) {
      //empty in nms
    } else if (packetType == config.packetType.sequenceEnd) {
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
      } else if (
        packetType == config.packetType.codedFrames ||
        packetType == config.packetType.codedFramesX
      ) {
        if (packetType == config.packetType.codedFrames) {
          payload = payload.subarray(3);
        } else {
          payload[2] = 0;
          payload[3] = 0;
          payload[4] = 0;
        }
        payload[0] = (frame_type << 4) | 0x0c;
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
        // Logger.info("PacketTypeSequenceStart", payload.subarray(0, 16));
      } else if (packetType == config.packetType.MPEG2TSSequenceStart) {
        // Logger.info("PacketTypeMPEG2TSSequenceStart", payload.subarray(0, 16));
      } else if (packetType == config.packetType.codedFrames) {
        // Logger.info("PacketTypeCodedFrames", payload.subarray(0, 16));
        payload[0] = (frame_type << 4) | 0x0d;
        payload[1] = 1;
        payload[2] = 0;
        payload[3] = 0;
        payload[4] = 0;
      }
    } else {
      Logger.rtmpLog(`unsupported extension header`);

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
      let info = AV.readAVCSpecificConfig(state.video.avcSequenceHeader);
      state.video.width = info.width;
      state.video.height = info.height;
      state.video.profileName = AV.getAVCProfileName(info);
      state.video.level = info.level;
    }
  }

  if (state.video.codec == 0) {
    state.video.codec = codec_id;
    state.video.codecName = config.video.codecName[codec_id];
    //logging goes here
    Logger.info(
      `[rtmp publish] Handle video. id=${state.id} streamPath=${state.streams.publish.path} frame_type=${frame_type} codec_id=${codec_id} codec_name=${state.video.codecName} ${state.video.width}x${state.video.height}`
    );
    streamStorage.events.emit('video', {
      id: state.id,
      stream_path: state.streams.publish.path,
      frame_type,
      codec_id,
      codec_name: state.video.codecName,
      video_width: state.video.width,
      video_height: state.video.height,
    });
  }
};

const rtmpDataHandler = (config, state, streamStorage) => {
  let offset =
    state.parserPacket.header.type === config.type.flexStream ? 1 : 0;
  let payload = state.parserPacket.payload.slice(
    offset,
    state.parserPacket.header.length
  );
  let dataMessage = AMF.decodeAmf0Data(payload);

  switch (dataMessage.cmd) {
    case '@setDataFrame': {
      if (dataMessage.dataObj) {
        state.audio.sampleRate = dataMessage.dataObj.audiosamplerate;
        state.audio.channels = dataMessage.dataObj.stereo ? 2 : 1;
        state.video.width = dataMessage.dataObj.width;
        state.video.height = dataMessage.dataObj.height;
        state.video.fps = dataMessage.dataObj.framerate;
      }

      let opt = {
        cmd: 'onMetaData',
        dataObj: dataMessage.dataObj,
      };
      state.metaData = AMF.encodeAmf0Data(opt);
      Logger.debug(
        `[rtmp data] data received. cmd=${dataMessage.cmd}, method=${
          dataMessage.method
        } ${utils.objRepr(dataMessage.dataObj)}`
      );
      //build JIT encoding info

      streamStorage.events.emit('metadata', {
        id: state.id,
        video_width: dataMessage.dataObj.width,
        video_height: dataMessage.dataObj.video_height,
        video_fps: dataMessage.dataObj.framerate,
        video_bit_rate: dataMessage.dataObj.videodatarate,
        video_codec: config.video.codecName[dataMessage.dataObj.videocodecid],
        audio_codec: config.audio.codecName[dataMessage.dataObj.audiocodecid],
        audio_sample_rate: dataMessage.dataObj.audiosamplerate,
        audio_channels: dataMessage.dataObj.stereo ? 2 : 1,
        audio_bit_rate: dataMessage.dataObj.audiodatarate,
        audio_sample_size: dataMessage.dataObj.audiosamplesize,
        encoder: dataMessage.dataObj.encoder,
      });

      break;
    }
  }
};

const rtmpInvokeHandler = (config, state, streamStorage) => {
  let offset =
    state.parserPacket.header.type === config.type.flexMessage ? 1 : 0;
  let payload = state.parserPacket.payload.slice(
    offset,
    state.parserPacket.header.length
  );
  let invokeMessage = AMF.decodeAmf0Cmd(payload);
  // Logger.info(invokeMessage);
  switch (invokeMessage.cmd) {
    case 'connect': //y
      onConnect(config, state, streamStorage, invokeMessage);
      break;
    case 'releaseStream':
      break;
    case 'FCPublish':
      break;
    case 'createStream': //y
      onCreateStream(config, state, streamStorage, invokeMessage);
      break;
    case 'publish': //y
      onPublish(config, state, streamStorage, invokeMessage);
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
    case 'deleteStream': //y
      onDeleteStream(config, state, streamStorage, invokeMessage);
      break;
    case 'closeStream': //y
      onCloseStream(config, state, streamStorage);
      break;
    case 'receiveAudio': //y
      onReceiveAudio(config, state, invokeMessage);
      break;
    case 'receiveVideo': //y
      onReceiveVideo(config, state, invokeMessage);
      break;
  }
};

/* RTMP CONTROL HANDLERS */

const onConnect = (config, state, streamStorage, invokeMessage) => {
  //invokeMessage.cmdObj.app = invokeMessage.cmdObj.app.replace('/', ''); //fix jwplayer
  //context.nodeEvent.emit('preConnect', this.id, invokeMessage.cmdObj);
  if (!state.status.isStarting) {
    return;
  }
  //state
  state.connect.cmdObj = invokeMessage.cmdObj;
  state.connect.appname = invokeMessage.cmdObj.app;
  state.connect.objectEncoding =
    invokeMessage.cmdObj.objectEncoding != null
      ? invokeMessage.cmdObj.objectEncoding
      : 0;
  state.connect.time = new Date();
  state.connect.startTimestamp = Date.now();
  state.connect.bitrateCache = {
    intervalMs: 1000,
    last_update: state.connect.startTimestamp,
    bytes: 0,
  };

  //functions
  state.connect.pingInterval = setInterval(() => {
    rtmpActions.sendPingRequest(config, state);
  }, state.connect.pingTime);
  rtmpActions.sendWindowACK(config, state, 5000000);
  rtmpActions.setPeerBandwidth(config, state, 5000000, 2);
  rtmpActions.setChunkSize(config, state, state.chunkSize.output);
  rtmpActions.respondConnect(config, state, invokeMessage.transId);

  //log the connect
  Logger.info(
    `[rtmp connect] id=${state.id} ip=${state.ip} app=${
      state.connect.appname
    } args=${JSON.stringify(invokeMessage.cmdObj)}`
  );
  //emit it for the server
  streamStorage.events.emit('connect', {
    id: state.id,
    app: state.connect.appname,
    tcURL: invokeMessage.cmdObj.tcUrl,
  });
};

const onCreateStream = (config, state, streamStorage, invokeMessage) => {
  rtmpActions.respondCreateStream(config, state, invokeMessage.transId);
};

const onPublish = (config, state, streamStorage, invokeMessage) => {
  if (typeof invokeMessage.streamName !== 'string') {
    return;
  }
  state.streams.publish.path =
    '/' + state.connect.appname + '/' + invokeMessage.streamName.split('?')[0];
  state.streams.publish.args = QueryString.parse(
    invokeMessage.streamName.split('?')[1]
  );
  state.streams.publish.id = state.parserPacket.header.stream_id;
  // context.nodeEvent.emit('prePublish', this.id, this.publishStreamPath, this.publishArgs);
  if (!state.status.isStarting) {
    return;
  }

  // if (this.config.auth && this.config.auth.publish && !this.isLocal) {
  //   let results = NodeCoreUtils.verifyAuth(this.publishArgs.sign, this.publishStreamPath, this.config.auth.secret);
  //   if (!results) {
  //     Logger.info(`[rtmp publish] Unauthorized. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId} sign=${this.publishArgs.sign} `);
  //     this.sendStatusMessage(this.publishStreamId, 'error', 'NetStream.publish.Unauthorized', 'Authorization required.');
  //     return;
  //   }
  // }

  if (streamStorage.publishers.has(state.streams.publish.path)) {
    reject(config, state, streamStorage);
    //logger goes here
    Logger.info(
      `[rtmp publish] Already has a stream. id=${state.id} streamPath=${state.streams.publish.path} streamId=${state.streams.publish.id}`
    );

    rtmpActions.sendStatusMessage(
      config,
      state,
      state.streams.publish.id,
      'error',
      'NetStream.Publish.BadName',
      'Stream already publishing'
    );
  } else if (state.status.isPublishing) {
    //Logger goes here
    Logger.info(
      `[rtmp publish] NetConnection is publishing. id=${state.id} streamPath=${state.streams.publish.path} streamId=${state.streams.publish.id}`
    );
    rtmpActions.sendStatusMessage(
      config,
      state,
      state.streams.publish.id,
      'error',
      'NetStream.Publish.BadConnection',
      'Connection already publishing'
    );
  } else {
    Logger.info(
      `[rtmp publish] New stream. id=${state.id} streamPath=${state.streams.publish.path} streamId=${state.streams.publish.id}`
    );

    streamStorage.publishers.set(state.streams.publish.path, state.id);
    state.status.isPublishing = true;

    streamStorage.events.emit('publish', {
      id: state.id,
      stream_path: state.streams.publish.path,
      stream_id: state.streams.publish.id,
      publish_args: state.streams.publish.args,
    });

    rtmpActions.sendStatusMessage(
      config,
      state,
      state.streams.publish.id,
      'status',
      'NetStream.Publish.Start',
      `${state.streams.publish.path} is now published.`
    );
    // for (let idlePlayerId of context.idlePlayers) {
    //   let idlePlayer = context.sessions.get(idlePlayerId);
    //   if (idlePlayer && idlePlayer.playStreamPath === this.publishStreamPath) {
    //     idlePlayer.onStartPlay();
    //     context.idlePlayers.delete(idlePlayerId);
    //   }
    // }
    // context.nodeEvent.emit('postPublish', this.id, this.publishStreamPath, this.publishArgs);
  }
};

const onReceiveAudio = (config, state, invokeMessage) => {
  state.status.isReceiveAudio = invokeMessage.bool;
  //logger goes here
  Logger.info(
    `[rtmp play] receiveAudio=${state.status.isReceiveAudio} id=${state.id} `
  );
};

const onReceiveVideo = (config, state, invokeMessage) => {
  state.status.isReceiveVideo = invokeMessage.bool;
  //Logger goes here
  Logger.info(
    `[rtmp play] receiveVideo=${state.status.isReceiveVideo} id=${state.id} `
  );
};

const onCloseStream = (config, state, streamStorage) => {
  //red5-publisher
  let closeStream = { streamId: state.parserPacket.header.stream_id };
  onDeleteStream(config, state, streamStorage, closeStream);
};

const onDeleteStream = (config, state, streamStorage, invokeMessage) => {
  Logger.debug(`[on delete] ${JSON.stringify(invokeMessage)}`);
  if (invokeMessage.streamId == state.streams.publish.id) {
    if (state.status.isPublishing) {
      //logging goes here
      Logger.info(
        `[rtmp publish] Close stream. id=${state.id} streamPath=${state.streams.publish.path} streamId=${state.streams.publish.id}`
      );
      //remove stream from publishers
      streamStorage.publishers.delete(state.streams.publish.path);
      //emit close event
      streamStorage.events.emit('close', {
        id: state.id,
        stream_path: state.streams.publish.path,
        stream_id: state.streams.publish.id,
      });

      if (state.status.isStarting) {
        rtmpActions.sendStatusMessage(
          config,
          state,
          state.streams.publish.id,
          'status',
          'NetStream.Unpublish.Success',
          `${state.streams.publish.path} is now unpublished.`
        );
      }
      state.status.isPublishing = false;
    }
    state.streams.publish.id = 0;
    state.streams.publish.path = '';
  }
};

const stop = (config, state, streamStorage) => {
  if (state.status.isStarting) {
    state.status.isStarting = false;

    if (state.streams.play.id > 0) {
      onDeleteStream(config, state, streamStorage, {
        streamId: state.streams.play.id,
      });
    }

    if (state.streams.publish.id > 0) {
      onDeleteStream(config, state, streamStorage, {
        streamId: state.streams.publish.id,
      });
    }

    if (state.pingInterval != null) {
      clearInterval(state.pingInterval);
      state.pingInterval = null;
    }

    Logger.info(`[rtmp disconnect] id=${state.id}`);
    streamStorage.events.emit('disconnect', { id: state.id });
    state.connect.cmdObj.bytesWritten = state.socket.bytesWritten;
    state.connect.cmdObj.bytesRead = state.socket.bytesRead;
    state.socket.destroy();

    return;
  }
};

const reject = (config, state, streamStorage) => {
  //logger goes here
  Logger.info(`[rtmp reject] id=${state.id}`);
  stop(config, state, streamStorage);
};

module.exports = {
  stop,
  handleRTMPHandshake,
};
