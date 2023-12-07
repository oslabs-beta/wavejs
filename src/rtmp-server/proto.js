

const onceFunc = (() => {
  let called = false;
  return (()=>{
    if (!called) {
      called = true
      return 'hello world'
    }
  })
})();

console.log(onceFunc())
console.log(onceFunc())