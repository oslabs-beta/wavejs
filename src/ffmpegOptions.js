const globalConfig = {
  overwriteOutputFiles: true,//-y
  _cliArgs: {
    overwriteOutputFiles: {
      flag: '-y',
      takesArg: false
    }
  } 
};
const AVConfig = {
  videoCodec: 'libx264', // -vcodec
  videoBitrate: 1200, //- b:v
  audioBitrate:  '256k', //-b:a
  audioCodec: 'aac', //-acodec
  audioChannels: 2,//-ac
  aspectRatio: undefined, //-aspect
  frameRate: undefined, //-r
  h264Preset: 'superfast',//-preset
  _cliArgs: {
    videoCodec: {
      flag: '-vcodec',
      takesArg: true
    },
    videoBitrate: {
      flag:'-b:v',
      takesArg: true,
    },
    audioBitrate: {
      flag: '-b:a',
      takesArg: true,
    },
    audioCodec: {
      flag: '-acodec',
      takesArg: true,
    },
    audioChannels: {flag: '-ac', takesArg: true},
    aspectRatio: {flag: '-aspect', takesArg: true},
    frameRate: {flag: '-r', takesArg: true},
    h264Preset: {flag: '-preset', takesArg: true}
  }
}

const dashConfig = {
  segDuration: 8,
  fragDuration: 1,
  fragType: undefined,
  windowSize: undefined,
  extraWindowSize: undefined,
  removeAtExit: undefined,
  useTemplate: undefined,
  useTimeline: undefined,
  singleFile: undefined,
  singleFileName: undefined,
  initSegName:  'init_$RepresentationID$.m4s',
  mediaSegName: 'chunk_$RepresentationID$_$Number%05d$.m4s',
  utcTimingUrl: undefined,
  method: undefined,
  httpUserAgent: undefined,
  httpPersistent: undefined,
  hlsPlaylist: undefined,
  hlsMasterName: undefined,
  streaming: true,
  adaptationSets: undefined,
  timeout: undefined,
  indexCorrection: undefined,
  formatOptions: undefined,
  globalSidx: undefined,
  dashSegmentType: undefined,
  ignoreIoErrors:  undefined,
  lhls:  undefined,
  ldash:  true,
  masterM3u8PublishRate:  undefined,
  writePrft:  undefined,
  mpdProfile:  undefined,
  httpOpts:  undefined,
  targetLatency:  undefined,
  minPlaybackRate:  undefined,
  maxPlaybackRate:  undefined,
  updatePeriod:  undefined,
}

const hlsConfig = {
  hlsInitTime: undefined,
  hlsTime:  1,
  hlsListSize:  1,
  hlsDeleteThreshold:  undefined,
  hlsStartNumberSource: undefined,
  startNumber:  undefined,
  hlsAllowCache:  undefined,
  hlsBaseUrl:  undefined,
  hlsSegmentFilename: undefined,
  strftime:  undefined,
  strftimeMkdir:  undefined,
  hlsSegmentOptions:  undefined,
  hlsKeyInfoFile:  undefined,
  hlsEnc: undefined,
  hlsEncKey: undefined,
  hlsEncKeyUrl: undefined,
  hlsEncIv: undefined,
  hlsSegmentType:  undefined,
  hlsFmp4InitFilename: undefined,
  hlsFmp4InitResend:  undefined,
  hlsFlags: undefined,
  hlsPlaylistType: undefined,
  method: undefined,
  httpUserAgent: undefined,
  varStreamMap: undefined,
  ccStreamMap: undefined,
  masterPlName: undefined,
  masterPlPublishRate: undefined,
  httpPersistent: undefined,
  timeout: undefined,
  ignoreIoErrors: undefined,
  headers:  undefined,
};

const streamConfig = {
  endpoint: 'wavejs',
  streamId: 'test',
  userId: 'testUser',
}

const config = {
  global: globalConfig,
  av: AVConfig,
  hls: hlsConfig,
  dash: dashConfig,
  stream: streamConfig
}

/* FUNCTIONS */

const configMappedPipe = (config) => {
  let output = config;
  output = configFilter(output);
  output = configValPipe(output);
  output = convertMappedConfig(output);
  return output;
};

const configUnmappedPipe = (config) => {
  let output = config;
  output = configFilter(output);
  output = configValPipe(output);
  output = convertUnmappedConfig(output);
  return output;
};


const convertMappedConfig = (config) => {
  if (!config._cliArgs) {
    throw new Error('config is missing _cliArgs subobject')
  }
  const output = [];
  const keys = Object.keys(config).filter(elem => elem !== '_cliArgs');
  let args = config._cliArgs;
  for (let key of keys) {
    output.push(args[key].flag)
    if (args[key].takesArg) {
      output.push(config[key])
    }
  }
  return output;
}

const convertUnmappedConfig = (config) => {
  const output = [];
  for (let [key, value] of Object.entries(config)) {
    output.push(convertFlag(key));
    output.push(value);
  }
  return output;
}

const convertFlag = (pascalCaseStr) => {
  let output = '-';
  for (let char of pascalCaseStr) {
    if (char === char.toUpperCase() && !char.match(/[0-9]/g)) {
      output += '_';
    }
    output += char.toLowerCase();
  }
  return output;
}

const configFilter = (obj) => {
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => v!== undefined));
}

const configValPipe = (obj) => {
  for (let key of Object.keys(obj)) {
    const val = obj[key];
    switch (typeof val) {
      case 'boolean': {
        obj[key] = val === true? 1 : 0;
        break;
      }
      case 'number': {
        obj[key] = String(val);
        break;
      }
      case 'undefined':      
      case 'string':
      case 'object':
      default: {
        break;
      }
    }
  } 
  return obj;
}


module.exports = {
  config, 
  convertUnmappedConfig,
  convertMappedConfig,
  configFilter,
  configValPipe,
  configMappedPipe,
  configUnmappedPipe,
}