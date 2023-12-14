# wave.js Documentation

## Contents

- [wave.js Documentation](#wavejs-documentation)
  - [Contents](#contents)
  - [Getting Started](#getting-started)
  - [Setting Up wave.js Server](#setting-up-wavejs-server)
  - [Configuring wave.js Server](#configuring-wavejs-server)
    - [Configuration Options](#configuration-options)
    - [Event Listeners](#event-listeners)
    - [Start/Stop Server](#startstop-server)
      - [updateAVSettings(updatedSettings)](#updateavsettingsupdatedsettings)
      - [updateOutputProtocol(...args)](#updateoutputprotocolargs)
      - [updateHLSOutput(updatedSettings)](#updatehlsoutputupdatedsettings)
      - [updateMPDOutput(updatedSettings)](#updatempdoutputupdatedsettings)
      - [updateOutputSettings(updatedSettings)](#updateoutputsettingsupdatedsettings)
      - [updateMediaDir(...args)](#updatemediadirargs)
      - [on(event, callback) and once(event, callback)](#onevent-callback-and-onceevent-callback)
      - [listen()](#listen)
      - [close()](#close)
  - [Accessing Live Streams and Video Files](#accessing-live-streams-and-video-files)
  - [Live Streaming with OBS Studio](#live-streaming-with-obs-studio)
  - [Using Custom Logs](#using-custom-logs)
  - [Code Example](#code-example)

## Getting Started

To get started using wave.js, install the npm package:

```bash
npm i @wave.js/wave.js
```
## Setting Up wave.js Server

wave.js is a Node.js-based server with functionality to configure and customize live streams. To set up a wave.js server:

1.  Include the WaveJS module:
```js
const WaveJS = require("@wave.js/wave.js");
```
2.  Create a new instance of a WaveJS server:

```js
const server = new WaveJS();
```
## Configuring wave.js Server

wave.js features a range of functions to tailor live streams to any development environment. Once you've created a new instance of a wave.js server, you can use the following built-in functions to configure and control live streams. Included are options to start and stop your server, add event listeners, configure input and output settings, and update the media directory where streams are saved:

### Configuration Options

- [Update AV Settings](#updateavsettingsupdatedsettings)
- [Update Output Protocol](#updateoutputprotocolargs)
- [Update HLS Output](#updatehlsoutputupdatedsettings)
- [Update MPD Output](#updatempdoutputupdatedsettings)
- [Update Output Settings](#updateoutputsettingsupdatedsettings)
- [Update Media Directory](#updatemediadirargs)

### Event Listeners

- [on(event, callback) and once(event, callback)](#onevent-callback-and-onceevent-callback)

### Start/Stop Server

- [Start Server](#listen)
- [Stop Server](#close)

#### updateAVSettings(updatedSettings)

Before you start streaming, configure your audio/video output settings to meet the needs of your project. The default configuration options are as follows:

```js
const AVConfig = {
  videoCodec: 'libx264',
  videoBitrate: '1200k',
  audioBitrate:  '256k',
  audioCodec: 'aac',
  audioChannels: 2,
  aspectRatio: undefined,
  frameRate: undefined,
  h264Preset: 'superfast',
}
```

To customize your A/V output:

1.  Create a new object with any updated settings. Note that all other options not included in the config object will retain their default settings:

```js
const updatedSettings = {
  videoBitrate: '1000K',
  h264Preset: 'medium'
}
```

2.  The updateAVSettings method accepts a single config object as its parameter. Invoke the updateAVSettings method and pass in the updated config object as an argument:

 ```js
server.updateAVSettings(updatedSettings);
```

#### updateOutputProtocol(...args)

wave.js currently supports output for HLS and MPEG-DASH streaming protocols. Users can select to output live streams in HLS, MPEG-DASH, or both concurrently:

- Output HLS: <code>jsserver.updateOutputProtocol('hls');</code>
- Output MPEG-DASH: <code>server.updateOutputProtocol('dash');</code>
- Output HLS and MPEG-DASH: <code>server.updateOutputProtocol('hls', 'dash')</code>

#### updateHLSOutput(updatedSettings)

The following HLS output options can be configured for your live stream, as provided by Ffmpeg video processing. For more information on each option, read the [FFmpeg Format Documentation](https://ffmpeg.org/ffmpeg-formats.html#Options-10).

- hlsInitTime
- hlsTime
- hlsListSize
- hlsDeleteThreshold
- hlsStartNumberSource
- startNumber
- hlsAllowCache
- hlsBaseUrl
- hlsSegmentFilename
- strftime
- strftimeMkdir
- hlsSegmentOptions
- hlsKeyInfoFile
- hlsEnc
- hlsEncKey
- hlsEncKeyUrl
- hlsEncIv
- hlsSegmentType
- hlsFmp4InitFilename
- hlsFmp4InitResend
- hlsFlags
- hlsPlaylistType
- method
- httpUserAgent
- varStreamMap
- ccStreamMap
- masterPlName
- masterPlPublishRate
- httpPersistent
- timeout
- ignoreIoErrors
- headers

The default HLS output settings for wave.js are:

- hlsTime: 1
- hlsListSize: 1

To configure your HLS output:

1.  Create a new object with any updated settings. Note that all other options not included in the config object will retain their default settings:
```js
const updatedSettings = {
  hlsStartNumberSource: 'datetime',
  hlsListSize: 0,
  hlsPlaylistType: 'event'
};
```

2.  The updateHLSOutput method accepts a single config object as its parameter. Invoke the updateHLSOutput method and pass in the updated config object as an argument:

    <code>server.updateHLSOutput(updatedSettings)</code>

#### updateMPDOutput(updatedSettings)

The following MPEG-DASH output options can be configured for your live stream, as provided by Ffmpeg video processing. For more information on each option, read the [FFmpeg Format Documentation](https://ffmpeg.org/ffmpeg-formats.html#dash-2).

- segDuration
- fragDuration
- fragType
- windowSize
- extraWindowSize
- removeAtExit
- useTemplate
- useTimeline
- singleFile
- singleFileName
- initSegName
- mediaSegName
- utcTimingUrl
- method
- httpUserAgent
- httpPersistent
- hlsPlaylist
- hlsMasterName
- streaming
- adaptationSets
- timeout
- indexCorrection
- formatOptions
- globalSidx
- dashSegmentType
- ignoreIoErrors
- lhls
- ldash
- masterM3u8PublishRate
- writePrft
- mpdProfile
- httpOpts
- targetLatency
- minPlaybackRate
- maxPlaybackRate
- updatePeriod

The default MPEG-DASH output settings for wave.js are:

- segDuration: 8
- fragDuration: 1
- initSegName: <code>init\_$RepresentationID$.m4s</code>
- mediaSegName: <code>chunk*$RepresentationID$*$Number%05d$.m4s</code>
- streaming: true
- ldash: true

To configure your MPEG-DASH output:

1.  Create a new object with any updated settings. Note that all other options not included in the config object will retain their default settings:
```js
const updatedSettings = {
  segDuration: 10,
  deshSegmentType: 'mp4',
  writePrft: true,
  targetLatency: 10,
}
```

2.  The updateMPDOutput method accepts a single config object as its parameter. Invoke the updateMPDOutput method and pass in the updated config object as an argument:

    <code>server.updateMPDOutput(updatedSettings)</code>

#### updateOutputSettings(updatedSettings)

The default output server port is 3000 and the default endpoint is 'wavejs':

<code>http://localhost:3000/wavejs</code>

To update the server port or endpoint, invoke the updateOutputSettings method and pass in a custom port (number) and/or a custom endpoint (string):

<code>server.updateOutputSettings(5555, 'newEndpoint')</code>

#### updateMediaDir(...args)

By default, wave.js stores video files in a 'videoFiles' directory in the current working directory. To set a custom directory name to store all streaming files, invoke the updateMediaDir() method and pass in the new directory name (string) as an argument.

<code>server.updateMediaDir('mediaDirectory')</code>

#### on(event, callback) and once(event, callback)

wave.js features an event emitter that invokes callback functions when the following events are fired:

- audio
- video
- metadata
- connect
- publish
- close
- disconnect

Create custom event handlers for the previous events that are tailored to your workflow. The 'on' method invokes the callback function every time an event occurs, and the 'once' method invokes the listener the first time the event occurs. Use the following formats:

<code>server.on(event, callback)</code>

<code>server.once(event, callback)</code>

Code Example:

```js
streamStorage.events.on('disconnect', () => {
  writeSocket.destroy();
  console.log(`${streamKey} streaming session ended.`)
});
```

#### listen()

Once you've configured your wave.js server, you're ready to start streaming. To start wave.js, invoke the listen method. This boots up the output server (default port 3000) and the RTMP server (default port 1935).

```js
server.listen();
```

#### close()

To stop wave.js, invoke the close method:

```js
server.close()
```

## Accessing Live Streams and Video Files

wave.js serves live streams and video files for on-demand playback. The default locations to access files are provided below. Ensure you replace ${streamKey} with the user stream key and provide the ${streamId} produced during recording if using the playback endpoint.

**Live Streams**

```
http://localhost:3000/wavejs/live/${streamKey}/manifest.m3u8
```

**Video Files for Playback**

```
http://localhost:3000/wavejs/playback/${streamKey}/${streamId}/manifest.m3u8
```

View the [demo repo](https://github.com/oslabs-beta/wavejs-test-site) to see how streams are accessed and served by a video player in React.

## Live Streaming with OBS Studio

To stream real-time RTMP from OBS Studio, use the following settings. Note that the Stream Key is required and should be unique for every end user.

![OBS Studio Settings](https://github.com/oslabs-beta/wavejs/blob/dev/assets/OBS_Studio_Settings.png?raw=true)

## Using Custom Logs

wave.js features built-in logging to track and monitor live stream progress and performance in real-time, including connected ports, current stream path and progress, warnings, and errors. The following log levels are available as methods that can be invoked with the Logger module:

- error
- warn
- info
- http
- rtmp
- debug

To create custom logs:

1. Include the <code>logger.js</code> module:

   <code>const Logger = require(‘@wave.js/wave.js’)</code>

2. Invoke the desired method:

   <code>Logger.info('New stream ${streamKey} is live.')</code>

Code Example:

```js
const port = 8000;

const app = express();

app.listen(port, () => {
  Logger.info('Listening on port ', port);
});
```

## Code Example

View the [wave.js demo site repository](https://github.com/oslabs-beta/wavejs-test-site) on GitHub as an example of a React application using wave.js.

View a code example of a project server that uses wave.js

```js
const express = require('express');
const path = require('path');

const { WaveJS, Logger } = require('@wave.js/wave.js');

const app = express();

const server = new WaveJS();

const port = 8000;

app.use(express.static(path.join(__dirname, '../../dist')));
app.use(express.static(path.join(__dirname, '../frontend')));

server.updateMediaDir(path.join(__dirname, 'media'));
server.updateOutputProtocol('hls');
server.updateHLSOutput({ hlsListSize: 0 });
server.updateOutputSettings({ endpoint: 'wavejs', port: 3000 });

server.listen();

app.listen(port, () => {
  Logger.info('Listening on port ', port);
});

```
