const express = require('express');
const path = require('path')
const WaveJS = require('../wavejs');



const app = express();
const server = new WaveJS();

const port = 8000;

app.get('/', (req,res)=>{
    res.status(200).sendFile(path.join(__dirname, './dist/index.html'))
})

server.configureAV({hlsListSize: ['-hls_list_size', '0']})
server.setInput({endpoint: 'wavejs', streamId:'mvp-demo'})
server.setOutput({endpoint: 'wavejs', port: 8080});

server.listen()

app.listen(port,()=>{
    console.log('Listening on port ', port)
})