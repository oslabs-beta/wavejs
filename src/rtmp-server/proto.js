const net = require('net');
const EventEmitter = require('node:events')

const server = net.createServer();

server.on('connect', (socket) => {
  console.log('client connected')
  console.log('address:', socket.address())
  socket.on('end', () => {
    console.log('client disconnected')
  })
  socket.on('data', (data)=> {
    const output = data.toString()
    //build a way to get path from this
    console.log('data recieved: ');
    console.log(data)//.split('\n')[0]);
  })
  socket.write('hello\r\n');
  socket.pipe(socket);
});

server.on('error', (err) => {
  throw err;
});

server.listen(8000, () => {
  console.log('Server listening at 8000')
})

const stuff = new EventEmitter();


stuff.emit('Hello!', 'World')

stuff.on('Hello', (text) => {
  console.log(text) // World
})