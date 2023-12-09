const net = require('net');
const _ = require('lodash');

const session = require('../session');
const Logger = require('../logger');

const MINIMUM_PORT = 1024;
const MAXIMUM_PORT = 49151;
const LOCALHOST_ADDRESS = '127.0.0.1';

const {
  handleRTMPHandshake: baseHandleRTMPHandshake,
  stop: baseStop,
} = require('./rtmp_handlers');
const { partialMod } = require('../utils');

const { config: baseConfig, state: baseState } = require('./_magic');


const loggerIdent = '[rtmp gateway]';

class RTMPGateway {
  constructor(streamStorage, transmuxServer) {
    this.config = _.cloneDeep(baseConfig);
    this.tcpServer = net.createServer();
    this.transmuxServer = transmuxServer;
    this.streamStorage = streamStorage;
    this.tcpServer.on('connection', this.onConnect.bind(this));
  }

  listen() {
    this.tcpServer.listen(this.config.port, () => {
      Logger.info(
        `🔮 Wave.js RTMP gateway started on port: ${this.config.port} `
      );
    });
    this.tcpServer.on('error', (err) => {
      Logger.error(`${loggerIdent} server: ${err}`);
    });
    this.tcpServer.on('close', () => {
      Logger.info(`${loggerIdent} 🔮 RTMP Server closed!`);
    });
  }
  setTransmuxServer(transmuxServer) {
    this.transmuxServer = transmuxServer;
  }

  stop() {
    this.tcpServer.close();
  }

  portGenerator() {
    const randomPortNumber = () => {
      return (
        Math.floor(Math.random() * (MAXIMUM_PORT - MINIMUM_PORT + 1)) +
        MINIMUM_PORT
      );
    };
    let portNumber;
    do {
      portNumber = randomPortNumber();
    } while (this.streamStorage.checkForActiveFfmpegPorts(portNumber));
    this.streamStorage.registerFfmpegPort(portNumber);
    return portNumber;
  }

  onConnect(socket) {
    console.log('on connect')
    /* INITIALIZE STATE */
    const state = _.cloneDeep(baseState);
    state.setSocket(socket);
    state.setId();
    state.socket.setTimeout(state.connect.pingTimeout);
    state.status.isStarting = true;
    /* Initialize Local Vars*/
    let retry = true;
    // let ffmpegServer = undefined;
    let transmuxServer = undefined;
    let streamKey;
    const newPort = this.portGenerator();
    const writeSocket = new net.Socket();
    let cachedData = undefined;

    Logger.debug(`${loggerIdent} streamId set to ${state.id}`);

    /* Initialize session methods*/
    const handleRTMPHandshake = partialMod(baseHandleRTMPHandshake, [
      this.config,
      state,
      this.streamStorage,
    ]);
    const stop = partialMod(baseStop, [this.config, state, this.streamStorage]);
    const checkIfPortIsOpen = () => {
      const checkPort = () => {
        try {
          if (retry) {
            retry = false;
            writeSocket.connect(newPort, LOCALHOST_ADDRESS, () => {
              Logger.info(`${newPort} is connected!`);
              clearInterval(portInterval);
            });
          }
        } catch (err) {
          retry = true;
          Logger.error('[write socket] Port is not open yet');
        }
      };
      const portInterval = setInterval(checkPort, 500);
    };

    /* STATE STORAGE EVENT LISTENERS */
    this.streamStorage.events.once('publish', (args) => {
      // stream_path is /wavejs/streamkey => slice to isolate the stream key
      streamKey = args.stream_path.slice(8);
      transmuxServer = this.transmuxServer.clone()
      transmuxServer.session = session;
      transmuxServer.port = newPort;
      // this is just used to tell transmuxer what the ids are
      transmuxServer.configureStream({
        streamId: String(state.id),
        userId: streamKey,
      });
      transmuxServer.listen();
      /* trigger ffmpeg */
      
      checkIfPortIsOpen();
    });

    this.streamStorage.events.on('disconnect', (arg) => {
      if (arg.id === state.id) {
        writeSocket.destroy();
        if (this.streamStorage.activeLiveStreams.has(streamKey))
          this.streamStorage.activeLiveStreams.delete(streamKey);
        if (this.streamStorage.ffmpegPorts.has(String(newPort)))
          this.streamStorage.ffmpegPorts.delete(String(newPort));
      }
    });

    /* WRITE SOCKET EVENT LISTENERS */
    writeSocket.on('ready', () => {
      Logger.debug(`[write socket] socket ready`);
    });
    writeSocket.on('connect', () => {
      Logger.debug(`[write socket] successful connection`);
    });
    writeSocket.on('error', (err) => {
      retry = true;
      Logger.error(`[write socket] socket error: ${err}`);
    });
    // writeSocket.on('data', (data) => { //eslint-disable-line no-unused-vars
    //   Logger.debug(`[write socket] data received`);
    // });

    /* STATE SOCKET EVENT LISTENERS */
    state.socket.on('data', (data) => {
      handleRTMPHandshake(data);
      if (
        writeSocket &&
        !writeSocket.pending &&
        writeSocket.readyState === 'open'
      ) {
        if (cachedData) {
          cachedData = Buffer.concat([cachedData, data]);
          writeSocket.write(cachedData);
          cachedData = undefined;
        } else {
          writeSocket.write(data);
        }
      } else {
        if (cachedData) {
          cachedData = Buffer.concat([cachedData, data]);
        } else {
          cachedData = Buffer.alloc(data.length);
          data.copy(cachedData);
        }
      }
    });
    state.socket.on('close', () => {
      //Logger.info('Outer socket close')
      stop();
    });
    state.socket.on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        Logger.error(`${loggerIdent} outer socket error: ${err}`);
        stop();
      }
    });
    state.socket.on('timeout', () => {
      Logger.error(`${loggerIdent} outer socket timeout`);
      stop();
    });
  }
}

module.exports = RTMPGateway;