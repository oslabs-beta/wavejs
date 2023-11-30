const { EventEmitter } = require('node:events')

const testEmit = new EventEmitter();


testEmit.on('log', (...args) => {
  console.log(`log called: ${args.join(' ')}`)
})

const storage = new Map();

storage.set('emitter', testEmit);


const alias = storage.get('emitter');

alias.emit('log', 'hello', 'world', 'my', 'good', 'friend')