let original = `ffmpeg 
  -rtmp_app wavejs/SM0B2NST 
  -listen 1 
  -i rtmp://127.0.0.1:40314 
  -y 
  -b:a 256k 
  -acodec aac 
  -ac 2 
  -b:v 1200k 
  -vcodec libx264 
  -preset superfast 
  -hls_time 1 
  -hls_list_size 0 
  /Users/evan/Development/Codesmith/OSP/_main/wavejs-project/wavejs/videoFiles/TestUser/SM0B2NST/hls/manifest.m3u8`

let updated = `ffmpeg 
  -rtmp_app wavejs/QGSFBZCN 
  -listen 1 
  -i rtmp://127.0.0.1:7097 
  -y 
  -b:a 256k 
  -acodec aac 
  -ac 2 
  -b:v 1200k 
  -vcodec libx264 
  -hls_time 1 
  -hls_list_size 0 
  -preset superfast 
  /Users/evan/Development/Codesmith/OSP/_main/wavejs-project/wavejs/videoFiles/TestUser/QGSFBZCN/hls/manifest.m3u8`