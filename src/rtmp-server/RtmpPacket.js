const RtmpPacket = {
  create: (fmt = 0, cid = 0) => {
    return {
      header: {
        fmt: fmt,
        cid: cid,
        timestamp: 0,
        length: 0,
        type: 0,
        stream_id: 0
      },
      clock: 0,
      payload: null,
      capacity: 0,
      bytes: 0
    };
  }
};

module.exports = RtmpPacket;