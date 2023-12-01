const WaveJS = require('../wavejs');

const server = new WaveJS();

server.configureAV({hlsListSize: ['-hls_list_size', '0'], protocols:['dash']})
server.setInput({endpoint: 'wavejs', streamId:'mvp-demo'})
server.setOutput({endpoint: 'wavejs', port: 3000});

server.listen()
