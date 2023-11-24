const net = require('net');


const server = net.createServer((socket) => {
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
})

server.on('error', (err) => {
  throw err;
});

server.listen(8000, () => {
  console.log('Server listening at 8000')
})