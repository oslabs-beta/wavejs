const net = require('net');
const _ = require('lodash');
const FFmpegServer = require('../FFmpegServer');

const Logger = require('../logger');

const MINIMUM_PORT = 1024;
const MAXIMUM_PORT = 49151;

const {
  onSocketData: baseOnSocketData,
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
    //bind onSocket handler to config and state
    const onSocketData = partialMod(baseOnSocketData, [config, state]);
    const stop = partialMod(baseStop, [config, state]);
    //streamStorage.sessions.set()
    //implement something to allow for customizing the

    // Generate a random port (localhost ports 1024 to 49151 are available for use)
    const portGenerator = () => {
      return (
        Math.floor(Math.random() * (MAXIMUM_PORT - MINIMUM_PORT + 1)) +
        MINIMUM_PORT
      );
    };

    const newPort = portGenerator();
    console.log(newPort);
    console.log(typeof newPort);

    const ffmpegServer = new FFmpegServer(newPort);
    ffmpegServer.configureAV({ hlsListSize: ['-hls_list_size', '0'] });
    ffmpegServer.configureStream({
      endpoint: 'wavejs',
      streamId: String(newPort),
    });
    //ffmpegServer.configureStream({ endpoint: 'wavejs', streamId: 'mvp-demo' });
    ffmpegServer.listen();

    let writeSocket = undefined;
    //const writeSocket = new net.Socket();

    function checkIfPortIsOpen() {
      const portInterval = setInterval(checkPort, 500);
      function checkPort() {
        if (net.isListening(newPort)) {
          clearInterval(portInterval);
          writeSocket = net.createConnection(newPort, '127.0.0.1', () => {
            console.log(`${newPort} is connected!`);
          });
          writeSocket.on('error', (err) => {
            console.log('WriteSocket ERROR!', err);
          });
        }
      }
    }

    checkIfPortIsOpen();

    // function checkPort() {
    //   if (net.is_listening(newPort)) {
    //     clearInterval(portInterval);
    //     writeSocket = net.createConnection(newPort, '127.0.0.1', () => {
    //       console.log(`${newPort} is connected!`);
    //     });
    //     writeSocket.on('error', (err) => {
    //       console.log('WriteSocket ERROR!', err);
    //     });
    //   }
    // }

    // Need to wait for port to be open before writing to it...
    setTimeout(() => {
      writeSocket = net.createConnection(newPort, '127.0.0.1', () => {
        console.log(`${newPort} is connected!`);
      });
      writeSocket.on('error', (err) => {
        console.log('WriteSocket ERROR!', err);
        // writeSocket.connect(55555, 'localhost', () => {
        //   console.log(`${newPort} is connected!`);
        // });
      });

      // writeSocket.connect(newPort, 'localhost', () => {
      //   console.log(`${newPort} is connected!`);
      // });
    }, 2000);

    // writeSocket.on('error', (err) => {
    //   console.log('WriteSocket ERROR!', err);
    //   // writeSocket.connect(55555, 'localhost', () => {
    //   //   console.log(`${newPort} is connected!`);
    //   // });
    // });

    let cachedData = undefined;

    //session, run
    state.socket.on('data', (data) => {
      onSocketData(data);
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
      Logger.error(`Outer socket error: ${err}`);
      stop();
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
