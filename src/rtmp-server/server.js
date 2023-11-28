const net = require('net');
const _ = require('lodash')

const Logger = require('../logger');

const { onSocketData: baseOnSocketData, stop: baseStop } = require('./rtmp_handlers')
const { partialMod } = require('./utils')

const { config: baseConfig, state: baseState } = require('./_magic')
const streamStorage = require('./global') //maybe use this for close



//Run on Init

const Server = () => {
  const config = _.cloneDeep(baseConfig);
  const state = _.cloneDeep(baseState);
  
  const tcpServer = net.createServer((socket) => {
    //bind session and config as needed here
    state.setSocket(socket)
    state.setId();
    //bind onSocket handler to config and state
    const onSocketData = partialMod(baseOnSocketData,[config, state]);
    const stop = partialMod(baseStop, [config, state]);
    //streamStorage.sessions.set()
    //implement something to allow for customizing the 

    //session, run
    socket.on('data',  (data) => {
      
      onSocketData(data)
    });
    socket.on('close', () => {stop()})
    socket.on('error', () => {stop()})
    socket.on('timeout', () => {stop()})
    state.socket.setTimeout(state.pingTimeout);
    state.status.isStarting = true;
  });
  return {
    server: tcpServer,
    run: () => {
      tcpServer.listen(config.port, ()=>{
        Logger.log(`🔮 RTMP Server started on port: ${config.port} `)
      });
      tcpServer.on('error', (err)=>{
        Logger.error(`RTMP Server: ${err}`)
      })
      tcpServer.on('close', ()=>{
        Logger.log(`🔮 RTMP Server closed!`)
      })
    },
    stop: () => {
      tcpServer.close();
    }
  };
}

const server = Server();

server.run();
