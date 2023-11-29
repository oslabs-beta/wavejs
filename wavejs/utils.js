const net = require('node:net')
const utils = {};

utils.objRepr = (obj, kVSep = ':', entrySep = ", ") => {
  let output = "";
  let entries = Object.entries(obj);
  if (entries.length < 1) {
    return false;
  }
  for (let i = 0; i < entries.length; i++ ) {
    let key = entries[i][0];
    let value = entries[i][1];
    output += `${key}${kVSep} ${value}`
    if (i !== entries.length - 1) {
      output += entrySep;
    }
  }
  return output;
};

utils.portCheck = (host, port, timeout = 400) => {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let status = null;
    let error = null;
    let connectionRefused = false;
    socket.on('connect', () => {
      console.log('portcheck: connect');
      status = 'open';
      socket.destroy();
    });
    socket.setTimeout(timeout);
    socket.on('timeout', () => {
      console.log('portcheck: timeout');
      status = 'in-use';
      socket.destroy();
    });
    socket.on('error', (err) => {
      console.log('portcheck: error');
      // if (err.code !== 'ECONNREFUSED') {
      //   error = err
      // } else {
      //   connectionRefused = true
      // }
      error = err;
      status = 'in-use';
    });
    socket.on('close', (err) => {
      if (err && !connectionRefused) {
        error = error || err;
      } else {
        error = null;
      }
      console.log('portcheck: close');
      return resolve([status, error, connectionRefused]);
    });
    socket.connect({ port: port });
  });
};

// let [status, error] = portCheck('tcp://localhost', 1935)

module.exports = utils;