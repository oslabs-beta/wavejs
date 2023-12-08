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

utils.partialMod = (module, inputArgs, filter = {}) => {
  const partialFunc = (func, ...inputArgs) => {
    return (...args) => {
      return func(...inputArgs, ...args);
    };
  };
  let output;
  if (typeof module === 'function') {
    output = partialFunc(module, ...inputArgs);
  } else if (typeof module === 'object') {
    output = {};
    let entries = Object.entries(module);
    let functions = entries.filter((entry) => typeof entry[1] === 'function');
    let notFunctions = entries.filter(
      (entry) => typeof entry[1] !== 'function'
    );
    for (let [k, func] of functions) {
      if (typeof func !== 'function') throw new Error();
      if (Object.hasOwn(filter, k)) {
        output[k] = partialFunc(func, ...filter[k]);
      } else {
        output[k] = partialFunc(func, ...inputArgs);
      }
    }
    Object.assign(output, Object.fromEntries(notFunctions));
  } else {
    throw new Error(`Type of input ${typeof module} is not supported.`);
  }

  return output;
};

module.exports = utils;
