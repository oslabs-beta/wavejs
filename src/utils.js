const net = require('node:net');
const utils = {};

utils.objRepr = (obj, kVSep = ':', entrySep = ', ') => {
  let output = '';
  let entries = Object.entries(obj);
  if (entries.length < 1) {
    return false;
  }
  for (let i = 0; i < entries.length; i++) {
    let key = entries[i][0];
    let value = entries[i][1];
    output += `${key}${kVSep} ${value}`;
    if (i !== entries.length - 1) {
      output += entrySep;
    }
  }
  return output;
};


module.exports = utils;
