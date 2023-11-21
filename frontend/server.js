const express = require('express');
const app = express();
const port = 8000;
const path = require('path')

app.get('/', (req,res)=>{
    res.status(200).sendFile(path.join(__dirname, './dist/index.html'))
})

app.listen(port,()=>{
    console.log('Listening on port ', port)
})