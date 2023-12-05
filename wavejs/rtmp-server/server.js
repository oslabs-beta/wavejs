const net = require('net');
const _ = require('lodash');
const FFmpegServer = require('../FFmpegServer');
const session = require('../session');
const utils = require('../utils');
const Logger = require('../logger');

const MINIMUM_PORT = 1024;
const MAXIMUM_PORT = 49151;
const LOCALHOST_ADDRESS = '127.0.0.1';

const {
  handleRTMPHandshake: baseHandleRTMPHandshake,
  stop: baseStop,
} = require('./rtmp_handlers');
const { partialMod } = require('./utils');

const { config: baseConfig, state: baseState } = require('./_magic');
const streamStorage = require('../session'); //maybe use this for close

//Run on Init
const Server = () => {
  //get initial state for server
  const config = _.cloneDeep(baseConfig);

  const tcpServer = net.createServer((socket) => {
    //bind session and config as needed here
    //  Logger.info('outer TCP Server Connection Started')
    //regenerate state for new sessions
    const config = _.cloneDeep(baseConfig);
    const state = _.cloneDeep(baseState);
    state.setSocket(socket);
    state.setId();
    console.log('The streamId is', state.id);

    //bind onSocket handler to config and state
    const handleRTMPHandshake = partialMod(baseHandleRTMPHandshake, [
      config,
      state,
      streamStorage,
    ]);
    const stop = partialMod(baseStop, [config, state, streamStorage]);
    //implement event listener
    /* avail events:

    audio
    video
    metadata
    connect
    publish
    close
    error
    disconnect
    */
    const logArgs = (event, arg) =>
      Logger.debug(`[emitter] ${event}: ${JSON.stringify(arg)}`);
    streamStorage.events.on('audio', (arg) => logArgs('audio', arg));
    streamStorage.events.on('video', (arg) => logArgs('video', arg));
    streamStorage.events.on('metadata', (arg) => logArgs('metadata', arg));
    streamStorage.events.on('connect', (arg) => logArgs('connect', arg));
    streamStorage.events.on('publish', (arg) => logArgs('publish', arg));
    streamStorage.events.on('close', (arg) => logArgs('close', arg));
    streamStorage.events.on('disconnect', (arg) => logArgs('disconnect', arg));
    streamStorage.events.on('error', (arg) =>
      Logger.error(`[emitter] error: ${utils.objRepr(arg)}`)
    );

    // Generate a random port (localhost ports 1024 to 49151 are available for use)
    const portGenerator = () => {
      const randomPortNumber = () => {
        return (
          Math.floor(Math.random() * (MAXIMUM_PORT - MINIMUM_PORT + 1)) +
          MINIMUM_PORT
        );
      };
      let portNumber;
      do {
        portNumber = randomPortNumber();
      } while (streamStorage.checkForActiveFfmpegPorts(portNumber));
      streamStorage.registerFfmpegPort(portNumber);
      return portNumber;
    };

    const newPort = portGenerator();

    const writeSocket = new net.Socket();

    writeSocket.on('error', (err) => {
      retry = true;
      Logger.error(`[write socket] socket error: ${err}`);
    });

    writeSocket.on('connect', () => {
      Logger.debug(`[write socket] successful connection`);
    });

    writeSocket.on('data', (data) => {
      Logger.debug(`[write socket] data received`);
    });
    writeSocket.on('ready', () => {
      Logger.debug(`[write socket] socket ready`);
    });

    let retry = true;
    let ffmpegServer = undefined;

    streamStorage.events.on('publish', (args) => {
      // stream_path is /wavejs/streamkey => slice to isolate the stream key
      let streamKey = args.stream_path.slice(8);
      ffmpegServer = new FFmpegServer(session, newPort);
      ffmpegServer.configureAV({ hlsListSize: ['-hls_list_size', '0'] });
      ffmpegServer.configureStream({
        endpoint: 'wavejs',
        streamId: String(state.id),
        userId: streamKey,
      });
      ffmpegServer.listen();

      const checkIfPortIsOpen = () => {
        const checkPort = () => {
          try {
            if (retry) {
              retry = false;
              writeSocket.connect(newPort, LOCALHOST_ADDRESS, () => {
                console.log(`${newPort} is connected!`);
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

      checkIfPortIsOpen();
    });

    // const writeSocket = new net.Socket();
    // let retry = true;

    // writeSocket.on('error', (err) => {
    //   retry = true;
    //   Logger.error(`[write socket] socket error: ${err}`);
    // });

    // writeSocket.on('connect', () => {
    //   Logger.debug(`[write socket] successful connection`);
    // });

    // writeSocket.on('data', (data) => {
    //   Logger.debug(`[write socket] data received`);
    // });
    // writeSocket.on('ready', () => {
    //   Logger.debug(`[write socket] socket ready`);
    // });

    // const checkIfPortIsOpen = () => {
    //   const checkPort = () => {
    //     try {
    //       if (retry) {
    //         retry = false;
    //         writeSocket.connect(newPort, LOCALHOST_ADDRESS, () => {
    //           console.log(`${newPort} is connected!`);
    //           clearInterval(portInterval);
    //         });
    //       }
    //     } catch (err) {
    //       retry = true;
    //       Logger.error('[write socket] Port is not open yet');
    //     }
    //   };
    //   const portInterval = setInterval(checkPort, 500);
    // };

    // checkIfPortIsOpen();

    let cachedData = undefined;

    //session, run
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
        Logger.error(`Outer socket error: ${err}`);
        stop();
      }
    });
    state.socket.on('timeout', () => {
      Logger.error(`Outer socket timeout`);
      stop();
    });
    state.socket.setTimeout(state.connect.pingTimeout);
    state.status.isStarting = true;
  });
  return {
    server: tcpServer,
    run: () => {
      tcpServer.listen(config.port, () => {
        Logger.info(`🔮 RTMP Server started on port: ${config.port} `);
      });
      tcpServer.on('error', (err) => {
        Logger.error(`RTMP Server: ${err}`);
      });
      tcpServer.on('close', () => {
        Logger.info(`🔮 RTMP Server closed!`);
      });
    },
    stop: () => {
      tcpServer.close();
    },
  };
};

module.exports = Server;
