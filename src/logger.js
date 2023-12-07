const chalk = require('chalk');
const { objRepr } = require('./utils');

const LOG_LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  http: 4,
  rtmp: 4,
  debug: 5,
};

const styles = {
  timestring: chalk.bgBlue.whiteBright,
  process: chalk.redBright,
  error: chalk.bgRedBright,
  warn: chalk.bgYellowBright,
  info: chalk.bgGreenBright,
  http: chalk.bgMagentaBright,
  rtmp: chalk.bgCyanBright,
  debug: chalk.bgCyanBright,
};

let currentLogLevel = LOG_LEVELS.debug;

const ignoreHeaders = ['user-agent', 'postman-token', 'host', 'connection'];

const timeString = () => {
  const ts = new Date();
  return ts.toLocaleDateString() + ' ' + ts.toLocaleTimeString();
};

const setLogLevel = (level) => {
  if (typeof level !== 'number') return;
  currentLogLevel = level;
};

const error = (...args) => {
  if (currentLogLevel < LOG_LEVELS.error) return;
  console.log(
    styles.timestring(timeString()),
    styles.process(process.pid),
    styles.error(' ERROR '),
    ...args
  );
};

const warn = (...args) => {
  if (currentLogLevel < LOG_LEVELS.warn) return;
  console.log(
    styles.timestring(timeString()),
    styles.process(process.pid),
    styles.warn(' WARN  '),
    ...args
  );
};

const info = (...args) => {
  if (currentLogLevel < LOG_LEVELS.info) return;
  console.log(
    styles.timestring(timeString()),
    styles.process(process.pid),
    styles.info(' INFO  '),
    ...args
  );
};

const httpLog = (...args) => {
  if (currentLogLevel < LOG_LEVELS.http) return;
  console.log(
    styles.timestring(timeString()),
    styles.process(process.pid),
    styles.http(' HTTP  '),
    ...args
  );
};

const rtmpLog = (...args) => {
  if (currentLogLevel < LOG_LEVELS.rtmp) return;
  console.log(
    styles.timestring(timeString()),
    styles.process(process.pid),
    styles.rtmp(' RTMP  '),
    ...args
  );
};

const debug = (...args) => {
  if (currentLogLevel < LOG_LEVELS.debug) return;
  console.log(
    styles.timestring(timeString()),
    styles.process(process.pid),
    styles.debug(' DEBUG '),
    ...args
  );
};

const expressHttpLogger = (req, res, next) => {
  const filteredHeaders = Object.assign({}, req.headers);
  ignoreHeaders.forEach((header) => {
    delete filteredHeaders[header];
  });
  httpLog(
    // `:${port}`,
    chalk.bgWhiteBright.black(req.method),
    req.originalUrl,
    objRepr(req.query) ? `query: ${objRepr(req.query)}` : '',
    objRepr(filteredHeaders) ? `headers: ${objRepr(filteredHeaders)}` : ''
  );
  return next();
};

module.exports = {
  LOG_LEVELS,
  setLogLevel,
  expressHttpLogger,
  error,
  warn,
  info,
  debug,
  httpLog,
  rtmpLog,
};
