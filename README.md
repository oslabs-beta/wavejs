![wave.js Banner](https://github.com/oslabs-beta/wavejs/blob/dev/assets/Banner.png?raw=true)

# wave.js

wave.js is a scalable video live streaming framework, with multi-stream support for real-time RTMP ingest, encoding to HLS and MPEG-DASH, and low-latency live stream delivery. Targeted at helping dev teams deploy live streaming applications with greater ease and efficiency, wave.js is an open source server framework for Node.js that features customizable configuration options to tailor video and audio live streams to meet the needs of any professional dev environment.

## Features

### RTMP Ingest

wave.js supports real-time ingest of multiple synchronous streams of RTMP over a single port and is ideal for use with OBS Studio, one of the leading tools used by Twitch streamers and content creators.

### Encoding to HLS & MPEG-DASH

At launch, wave.js features powerful real-time encoding to popular streaming protocols HLS and MPEG-DASH via Ffmpeg’s open source video library. Users can configure encoding settings – including audio and video bitrate and codec – ensuring streams are delivered in whatever format required.

### Multi-Stream Ingest & Delivery

Developed with scalability in mind, wave.js is capable of ingesting and outputting a high volume of concurrent live streams.

### Video Chunking

Chunking live video into smaller segments expedites real-time encoding and delivery, enabling low-latency live streams. Automatic video chunking is managed by Ffmpeg, with configuration options for dev teams to manage chunking by length or size.

### Saving Files for On-Demand Viewing

Users can configure file location to save video and audio streams locally or on the cloud, for on-demand playback after live streams have ended.

### Detailed Logging to Monitor Progress and Performance

Stay up-to-date on live stream progress and performance, with in-depth, detailed logging. View connected ports, current stream paths and processes, warnings, and error messages in real-time.

## Getting Started

To get started, install the npm package:

`npm i @wave.js/wave.js`

Read the [documentation](https://github.com/oslabs-beta/wavejs/tree/dev/documentation) for full details on how to configure wave.js and get up-and-running.

## Contributors

• [Evan Pearson](https://github.com/parsnbl)
• [Stephanie Cummins](https://github.com/StephCummins)
• [Pedro Montibello](https://github.com/PMontibello)
• [Sean Kirkpatrick](https://github.com/kirkpatricksk)

## Contributing

Would you like to get involved? To contribute to wave.js:

- Notify us of any issues on [GitHub](https://github.com/oslabs-beta/wavejs/issues)

- Fork the project repo and make a contribution to the code

  1. For the project repo
  2. Create a feature branch
  3. Commit your changes
  4. Push to your branch
  5. Open a new PR

- Please show your support and star the wave.js repo if you found this project helpful

Thank you for your support!

## License

wave.js is distributed under the [MIT License](https://github.com/oslabs-beta/wavejs/blob/dev/LICENSE)
