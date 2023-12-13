const outputMiddleware = require('../src/outputMiddleware');


jest.mock('../src/logger', () => {
  return {
    debug: jest.fn(),
    error: jest.fn()
  }
});
jest.mock('node:fs', () => {
  return {
    existsSync: jest.fn(),
  }
})

const Logger = require('../src/logger');
const fs = require('node:fs')

describe('@ outputMiddleware tests', () => {
  let mockRequest;
  let mockResponse;
  let mockNext = jest.fn();
  let session;
  let loggerIdent;

  describe('# getParams', ()=>{
    beforeEach(()=>{
      mockRequest = {
        path: '/wavejs/live/TestUser/manifest.m3u8',
        params: {
          streamKey: 'TestUser',
          extension: 'manifest.m3u8',
          streamId: 'ULLLQ1ZM',
        },
      },
      mockResponse = {};
      loggerIdent = '[test ident]'
    });
    afterEach(()=>{
      jest.clearAllMocks();
    })
    
    test('with correct input, params are put into locals correctly', () => {
      outputMiddleware.getParams(loggerIdent, mockRequest, mockResponse, mockNext);
      expect(mockResponse.locals.endpoint).toBe('wavejs')
      expect(mockResponse.locals.streamKey).toEqual(mockRequest.params.streamKey);
      expect(mockResponse.locals.fullExtension).toEqual(mockRequest.params.extension);
      expect(mockResponse.locals.ext).toBe('m3u8');
      expect(mockResponse.locals.streamId).toEqual(mockRequest.params.streamId);
    });

    test('with correct input, next is called', () => {
      outputMiddleware.getParams(loggerIdent, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
    
    test('with correct input, logger.debug is called', () => {
      outputMiddleware.getParams(loggerIdent, mockRequest, mockResponse, mockNext);
      expect(Logger.debug).toHaveBeenCalledTimes(1);
      expect(Logger.debug).toHaveBeenCalledWith('[test ident] endpoint: wavejs/TestUser/manifest.m3u8');
    });
    
    test('with missing path, call next with error', () => {
      mockRequest.path = '';
      outputMiddleware.getParams(loggerIdent, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith({
          log: "outputMiddleware.getParams: a parameter is undefined, endpoint=, streamKey=TestUser, fullExtension=manifest.m3u8, ext=m3u8",
          code: 400,
          message: {err: 'Bad request'}
      });
    });
    test('with missing streamKey, call next with error', () => {
      mockRequest.params.streamKey = undefined;
      outputMiddleware.getParams(loggerIdent, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith({
          log: "outputMiddleware.getParams: a parameter is undefined, endpoint=wavejs, streamKey=undefined, fullExtension=manifest.m3u8, ext=m3u8",
          code: 400,
          message: {err: 'Bad request'}
      });
    });
    test('with mising fullExtension, call next with error', () => {
      mockRequest.params.extension = undefined;
      outputMiddleware.getParams(loggerIdent, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith({
          log: "outputMiddleware.getParams: a parameter is undefined, endpoint=wavejs, streamKey=TestUser, fullExtension=undefined, ext=undefined",
          code: 400,
          message: {err: 'Bad request'}
      });
    });
    test('with malformed req, call next with error', () => {
      mockRequest = {}
      outputMiddleware.getParams(loggerIdent, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith({
        "code": 400,
        "log": "outputMiddleware.getParams: TypeError: Cannot read properties of undefined (reading 'slice')",
        "message": {"err": "Bad request"}
      });

    });


  });

  describe('# getLiveStream', ()=>{

    beforeEach(()=>{
      session = {
        activeLiveStreams: {
          get: jest.fn((key) => 'ULLLQ1ZM'/*streamId*/),
        },
        getOutputStreamPath: jest.fn((streamId, protocol) => '/testpath/videoFiles/TestUser/ULLLQ1ZM'/** streamPath */)
      };
      mockResponse = {
        locals:{
          streamKey: 'TestUser',
          ext: 'm3u8',
          fullExtension: 'manifest.m3u8',
      }};
      loggerIdent = '[test ident]'
    });
  

    afterEach(()=>{
      jest.clearAllMocks();
    });
    // HLS
    test('when hls manifest request wellformed, contentType and videoPath added to locals', () => {
      fs.existsSync.mockImplementation(videoPath => true);
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockResponse.locals).toEqual({
        contentType: "application/x-mpegURL",
        ext: "m3u8",
        fullExtension: "manifest.m3u8",
        streamKey: "TestUser",
        videoPath: "/testpath/videoFiles/TestUser/ULLLQ1ZM/manifest.m3u8"});
    });
    test('when hls manifest request wellformed, next called once', ()=>{
      fs.existsSync.mockImplementation(videoPath => true);
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('when hls chunk request wellformed, contentType and videoPath added to locals', () => {
      fs.existsSync.mockImplementation(videoPath => true);
      mockResponse.locals.ext = 'ts';
      mockResponse.locals.fullExtension = 'manifest1.ts';
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockResponse.locals).toEqual({
        contentType: "application/x-mpegURL",
        ext: "ts",
        fullExtension: "manifest1.ts",
        streamKey: "TestUser",
        videoPath: "/testpath/videoFiles/TestUser/ULLLQ1ZM/manifest1.ts"});
    });
    test('when hls chunk request wellformed, next called once', ()=>{
      fs.existsSync.mockImplementation(videoPath => true);
      mockResponse.locals.ext = 'ts';
      mockResponse.locals.fullExtension = 'manifest1.ts';
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
    //MPD
    test('when mpd manifest request wellformed, contentType and videoPath added to locals', () => {
      fs.existsSync.mockImplementation(videoPath => true);
      mockResponse.locals.ext = 'mpd'
      mockResponse.locals.fullExtension = 'manifest.mpd';
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockResponse.locals).toEqual({
        contentType: "application/dash+xml",
        ext: "mpd",
        fullExtension: "manifest.mpd",
        streamKey: "TestUser",
        videoPath: "/testpath/videoFiles/TestUser/ULLLQ1ZM/manifest.mpd"});
    });
    test('when mpd manifest request wellformed, next called once', ()=>{
      fs.existsSync.mockImplementation(videoPath => true);
      mockResponse.locals.ext = 'mpd'
      mockResponse.locals.fullExtension = 'manifest.mpd';
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
    test('when mpd chunk request wellformed, contentType and videoPath added to locals', () => {
      fs.existsSync.mockImplementation(videoPath => true);
      mockResponse.locals.ext = 'm4s'
      mockResponse.locals.fullExtension = 'chunk_1_00001.m4s';
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockResponse.locals).toEqual({
        contentType: "application/dash+xml",
        ext: "m4s",
        fullExtension: "chunk_1_00001.m4s",
        streamKey: "TestUser",
        videoPath: "/testpath/videoFiles/TestUser/ULLLQ1ZM/chunk_1_00001.m4s"});
    });
    test('when mpd chunk request wellformed, next called once', ()=>{
      fs.existsSync.mockImplementation(videoPath => true);
      mockResponse.locals.ext = 'm4s'
      mockResponse.locals.fullExtension = 'manifest.m3u8';
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('if video doesn\'t exist, next called with error', ()=>{
      fs.existsSync.mockImplementation(videoPath => false);
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith({
        code: 404,
        log: "outputMiddleware.getStream: stream at undefined isn't available",
        message: {err: "Not found"}
      });
    });
    test('when provided ext isn\'t supported, next called with error', ()=>{
      fs.existsSync.mockImplementation(videoPath => true);
      mockResponse.locals.ext = 'junk'
      mockResponse.locals.fullExtension = 'manifest.junk'
      outputMiddleware.getLiveStream(loggerIdent, session, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith({
        code: 400,
        log: "outputMiddleware.getStream: provided 'ext' of junk not supported",
        message:  {err: "Bad request"},
      });
    });
  });
  describe('# populatePlaybackStreams', () => {
    let mediaRoot;
    beforeEach(()=>{
      session = {
        collectPlaybackStreams: jest.fn(),
      };
      mockResponse = {
        locals:{
          streamKey: 'TestUser',
          streamId: 'ULLLQ1ZM'
      }};
      mediaRoot = '/testpath/media/'
      loggerIdent = '[test ident]'
      });
  

    afterEach(()=>{
      jest.clearAllMocks();
    });

    test('should call session collectPlaybackStreams methods', async () => {
      session.collectPlaybackStreams.mockImplementation((...args) => {
        return P
      })  
      await outputMiddleware.populatePlaybackStreams(loggerIdent, session, mediaRoot, mockRequest, mockResponse, mockNext);
      expect(session.collectPlaybackStreams).toHaveBeenCalledTimes(1);
      expect(session.collectPlaybackStreams).toHaveBeenCalledWith(mockResponse.locals.streamId, mockResponse.locals.streamKey, mediaRoot);
    });

    test('should call next once if no errors', async () => {
      await outputMiddleware.populatePlaybackStreams(loggerIdent, session, mediaRoot, mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('if session.collectPlaybackStreams throws an error, it calls the specific error', () => {

    });

  });
  describe('# getPlaybackStream', ()=>{

    
  });
});
