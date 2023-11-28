const WaveJS = require('../wavejs');

const server = new WaveJS();

server.configureAV({hlsListSize: ['-hls_list_size', '1']})
server.setInput({endpoint: 'wavejs', streamId:'mvp-demo'})
server.setOutput({endpoint: 'wavejs', port: 8080});

server.listen()
