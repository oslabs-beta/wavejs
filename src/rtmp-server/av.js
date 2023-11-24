const Bitop = require('./node_core_bitop');

const readAACSpecificConfig = (aacSequenceHeader, config) => {
  let info = {};
  let bitop = new Bitop(aacSequenceHeader);
  bitop.read(16);
  info.object_type = getObjectType(bitop);
  info.sample_rate = getSampleRate(bitop, info, config);
  info.chan_config = bitop.read(4);
  if (info.chan_config < config.audio.aacChannels.length) {
    info.channels = config.audio.aacChannels[info.chan_config];
  }
  info.sbr = -1;
  info.ps = -1;
  if (info.object_type == 5 || info.object_type == 29) {
    if (info.object_type == 29) {
      info.ps = 1;
    }
    info.ext_object_type = 5;
    info.sbr = 1;
    info.sample_rate = getSampleRate(bitop, info, config);
    info.object_type = getObjectType(bitop);
  }

  return info;
};

function getObjectType(bitop) {
  let audioObjectType = bitop.read(5);
  if (audioObjectType === 31) {
    audioObjectType = bitop.read(6) + 32;
  }
  return audioObjectType;
}

function getSampleRate(bitop, info, config) {
  info.sampling_index = bitop.read(4);
  return info.sampling_index == 0x0f ? bitop.read(24) : config.audio.sampleRate[info.sampling_index];
}

function getAACProfileName(info) {
  switch (info.object_type) {
    case 1:
      return 'Main';
    case 2:
      if (info.ps > 0) {
        return 'HEv2';
      }
      if (info.sbr > 0) {
        return 'HE';
      }
      return 'LC';
    case 3:
      return 'SSR';
    case 4:
      return 'LTP';
    case 5:
      return 'SBR';
    default:
      return '';
  }
}

module.exports = {
  readAACSpecificConfig,
  getAACProfileName,
}