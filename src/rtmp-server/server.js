const net = require('net');
const _ = require('lodash');

const Logger = require('../logger');

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

    //session, run
    state.socket.on('data', (data) => {
      onSocketData(data);
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
