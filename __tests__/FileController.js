const FileController = require('../wavejs/FileController');
const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path');

jest.mock('node:crypto', () => {
  return { randomUUID: jest.fn()}
})

jest.mock('node:fs', () => {
  return {
    mkdir: jest.fn(),
    rmdir: jest.fn(),
  }
})
// beforeEach(() =>{
//   fc = new FileController('test')
//   jest.mock('fs');
//   jest.mock('crypto');
//   jest.mock('path');
// });

describe('@File Controller tests', ()=>{
  let fc;
  
  describe('# constructor', () => {
    test('constructor starts with the correct information', () => {
      fc = new FileController('test');
      expect(fc._mediaRoot).toBe('../videoFiles');
      expect(fc._streamId).toBe('test');
    })
    test('constructor called without a stream argument shouldn\'t work', ()=>{
      expect(() => {new FileController()}).toThrow()
    });
  })
  describe('# stream methods', () => {
    let uuid;

    beforeEach(() => {
      fc = new FileController('test')
      uuid = 'faa7488d-c6e4-43c8-8cb7-6c23b3003bda'
      crypto.randomUUID.mockReturnValue(uuid);
    });
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('getStreamId returns streamId', ()=>{
      const output = fc.getStreamId();
      expect(typeof output).toBe('string')
      expect(output).toEqual(fc._streamId)
    });
    
    test('setStreamId sets a new streamId', ()=>{
      const arg = 'new_test_id'
      fc.setStreamId(arg);
      expect(fc._streamId).toEqual(arg);
    });

    test('setStreamId throws an error if input isn\'t a string', ()=>{
      let arg = 9999
      expect(()=>{fc.setStreamId(arg)}).toThrow();
      arg = null;
      expect(()=>{fc.setStreamId(arg)}).toThrow();
      arg = undefined;
      expect(()=>{fc.setStreamId(arg)}).toThrow();
      arg = {'key': 'value'};
      expect(()=>{fc.setStreamId(arg)}).toThrow();
      arg = ['a', 'b','c'];
      expect(()=>{fc.setStreamId(arg)}).toThrow();
    })

    test('setStreamId returns nothing', () => {
      const output = fc.setStreamId('test');
      expect(output).toBe(undefined);
    });

    test('generateStreamId returns a new streamID', ()=>{
      const output = fc.generateStreamId();
      expect(typeof output).toBe('string');
      expect(output).toEqual(uuid);
    });

    test('generateStreamId calls crypto once', ()=>{
      fc.generateStreamId();
      expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    });
  });

  describe('# HLS methods', () => {
    let spy;
    let outputPath = '/Users/evan/Development/Codesmith/OSP/_main/wavejs/videoFiles/hls/test';
    beforeEach(() =>{
      fc = new FileController('test')
      spy = jest.spyOn(path, 'join');

    });
    afterEach(()=>{
      jest.clearAllMocks();
    });

    test('buildHLSDirPath returns a path', ()=>{
      const output = fc.buildHLSDirPath();
      expect(typeof output).toEqual('string')
    });

    test('buildHLSDirPath path includes current mediaRoot, hls, and streamId', ()=>{
      fc.buildHLSDirPath();
      const wave_dirname = path.resolve('wavejs')
      expect(spy).toHaveBeenCalledWith(wave_dirname, fc._mediaRoot, 'hls', fc._streamId)
    });

    test('buildHLSPlaylistPath returns a path', ()=>{
      const output = fc.buildHLSPlaylistPath();
      expect(typeof output).toEqual('string')
      expect(output.slice(output.length-13)).toBe('manifest.m3u8')
    });
    test('buidlHLSPlaylistPath calls BuildHLSDirPath', () => {
      spy = jest.spyOn(fc, 'buildHLSDirPath');
      fc.buildHLSPlaylistPath();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('buildHLSDir calls buildHLSDirPath', () => {
      spy = jest.spyOn(fc, 'buildHLSDirPath');
      fc.buildHLSDir();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('buildHLSDir calls fs.mkdir on path', () => {
      fc.buildHLSDir()
      expect(fs.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.mkdir.mock.calls[0][0]).toBe(outputPath);
    });
    
    test('deleteHLSDir calls buildHLSDirPath', () => {
      spy = jest.spyOn(fc, 'buildHLSDirPath');
      fc.deleteHLSDir();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('deleteHLSDir calls fs.rmdir on path', () => {
      fc.deleteHLSDir()
      expect(fs.rmdir).toHaveBeenCalledTimes(1);
      expect(fs.rmdir.mock.calls[0][0]).toBe(outputPath);
    });

  });
  describe('# MPD methods', () => {
    let spy;
    let outputPath = '/Users/evan/Development/Codesmith/OSP/_main/wavejs/videoFiles/mpd/test';
    beforeEach(() =>{
      fc = new FileController('test')
      spy = jest.spyOn(path, 'join');

    });
    afterEach(()=>{
      jest.clearAllMocks();
    });

    test('buildMPDDirPath returns a path', ()=>{
      const output = fc.buildMPDDirPath();
      expect(typeof output).toEqual('string')
    });

    test('buildMPDDirPath path includes current mediaRoot, hls, and streamId', ()=>{
      fc.buildMPDDirPath();
      const wave_dirname = path.resolve('wavejs')
      expect(spy).toHaveBeenCalledWith(wave_dirname, fc._mediaRoot, 'mpd', fc._streamId)
    });

    test('buildMPDPlaylistPath returns a path', ()=>{
      const output = fc.buildMPDPlaylistPath();
      expect(typeof output).toEqual('string')
      expect(output.slice(output.length-12)).toBe('manifest.mpd')
    });
    test('buidlHLSPlaylistPath calls BuildHLSDirPath', () => {
      spy = jest.spyOn(fc, 'buildMPDDirPath');
      fc.buildMPDPlaylistPath();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('buildMPDDir calls buildMPDDirPath', () => {
      spy = jest.spyOn(fc, 'buildMPDDirPath');
      fc.buildMPDDir();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('buildMPDDir calls fs.mkdir on path', () => {
      fc.buildMPDDir()
      expect(fs.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.mkdir.mock.calls[0][0]).toBe(outputPath);
    });
    
    test('deleteMPDDir calls buildMPDDirPath', () => {
      spy = jest.spyOn(fc, 'buildMPDDirPath');
      fc.deleteMPDDir();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('deleteMPDDir calls fs.rmdir on path', () => {
      fc.deleteMPDDir()
      expect(fs.rmdir).toHaveBeenCalledTimes(1);
      expect(fs.rmdir.mock.calls[0][0]).toBe(outputPath);
    });

  });
  
})