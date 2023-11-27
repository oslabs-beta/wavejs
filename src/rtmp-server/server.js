const tls = require('tls');
const fs = require('fs');
const net = require('net');
const Handshake = require('./node_rtmp_handshake')
const { config, state } = require('./_magic')
const { readRtmpChunk } = require('./rtmp_handlers')

//Run on Init
const tcpServer = net.createServer((socket) => {
  // session, init
  let res = socket;
  let ip = socket.remoteAddress;
  let rtmpGopCache = new Set();

  //session, run
  socket.on('data',  dataSocketHandler);
  state.socket.setTimeout(state.pingTimeout);
  state.status.isStarting = true;
})

dataSocketHandler = (data, stopCb) => {
  let bytes = data.length;
  let bytesRead = 0; //what is this // p
  let bytesToProcess = 0; // what is this // n
  while (bytes > 0) {
    switch (state.handshake.handshakeStage) {
      case config.handshakeStages.uninit:
        //start the handshake, get C0 from client
        state.handshake.handshakeStage = config.handshakeStages.c1_to_s0_s1_s2;
        state.handshake.handshakeBytes = 0;
        bytes -= 1;
        bytesRead +=1;
        break;
      case config.handshakeStages.c1_to_s0_s1_s2:
        //get the 1536 rqndom bytes and store them (c1)
        //set number of bytes to process
        bytesToProcess = config.handshake_size - state.handshake.handshakeBytes;
        //if bytesToProcess  is lt-eq bytes, keep bytes as is, otherwise ensure it's the size of bytes
        bytesToProcess = bytesToProcess <= bytes ? bytesToProcess: bytes;
        //copy the random bites
        data.copy(state.handshake.handshakePayload, state.handshake.handshakeBytes, bytesRead, bytesRead + bytesToProcess)
        //increment handshake bytes and bytesRead by the amount processed, decrementing bytes remaining
        state.handshake.handshakeBytes += bytesToProcess;
        bytesRead += bytesToProcess;
        bytes -= bytesToProcess;
        //if this is the full handshake, move to rtmp_handshake_1 and send S0, S1, and S2, reset handshakeBytes
        if (state.handshake.handshakeBytes === config.handshake_size) {
          state.handshake.handshakeStage = config.handshakeStages. c2_to_connection;
          state.handshake.handshakeBytes = 0;
          //Build s0_s1_s2
          let s0_s1_s2 = Handshake.generateS0S1S2(state.handshake.handshakePayload)
          socket.write(s0_s1_s2)
        }
        break;
      case config.handshakeStages.c2_to_connection:
        //manage C2 (the 1536 bytes the client is sending over to confirm they're legit)
        //set number of bytes to process
        bytesToProcess = config.handshake_size - state.handshake.handshakeBytes;
        //if bytesToProcess  is lt-eq bytes, keep bytes as is, otherwise ensure it's the size of bytes
        bytesToProcess = bytesToProcess <= bytes ? bytesToProcess: bytes;
        data.copy(state.handshake.handshakePayload, state.handshake.handshakeBytes, bytesRead, bytesToProcess)
         //increment handshake bytes and bytesRead by the amount processed, decrementing bytes remaining
         state.handshake.handshakeBytes += bytesToProcess;
         bytesRead += bytesToProcess;
         bytes -= bytesToProcess;
         //if the sent handshake matches the number of bytes we sent, then C2 is valid and move to state 2 (connection)
         if (state.handshake.handshakeBytes === config.handshake_size) {
          state.handshake.handshakeStage = config.handshakeStages.begin_processing;
          state.handshake.handshakeBytes = 0;
          state.handshake.handshakePayload = null;
         }
        break;
      case config.handshakeStages.begin_processing:
      default:
        //connection has occured, we're away at the races
        //read chunk
      return readRtmpChunk(data, p, bytes, stopCb);
      
    }
  }
}


tcpServer.listen(RTMP_PORT, ()=>{})

//Run on Start
tcpServer.on('error', ()=>{})
tcpServer.on('close', ()=>{})
tcpServer.on('error', ()=>{})

//Run on Close
tcpServer.close()


// session, init
let socket
let ip = 
//session, run