

const Outer = () => {
  console.log('hello from init')
  const names = ['Evan', 'Pedro', 'Steph', 'Sean'];
  const name = names[Math.floor(Math.random()*names.length)];
  console.log('the name would be', name)
  return {
    hello: () => `hello ${name}`,
    bye: () => `bye ${name}`,
    band: () => `banned in DC, ${name}`,
  }
}

const mod = Outer();
console.log(mod.hello())
console.log(mod.hello())
console.log(mod.hello())
console.log(mod.hello())
console.log(mod.hello())
console.log(mod.hello())