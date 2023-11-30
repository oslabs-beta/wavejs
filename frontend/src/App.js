import React from 'react'
import ShakaPlayer from 'shaka-player-react'
// import 'shaka-player/dist/controls.css'
//<iframe width="560" height="315" src="https://www.youtube.com/embed/qWNQUvIk954?si=JXgJJpEGUwkYjDWC" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{display:"block", margin:"auto"}}></iframe>
export default function App() {
    return (
      <div>
        <ReactHeader />
        <ReactBody />
        <VideoDisplay />
        {/* <ShakaPlayer autoPlay src="http://localhost:3000/video/test/manifest.mpd" crossorigin="anonymous" /> */}
      </div>
    );
  }




  function ReactHeader(){return(
    <h1 style={{display:"flex", alignItems:"center", justifyContent:"space-around"}}>Front End Proof of Concept</h1>
    )
  }
  function ReactBody(){
    return(
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-around"}}>We're putting a video player here</div>
    )
  }
  function VideoDisplay(){
    return(
        <video width="620" controls 
        
        autoPlay
        style={{
        display:"block", 
        marginLeft:"auto", 
        marginRight:"auto"
        }}>
          <source src="http://localhost:3000/wavejs/mvp-test/manifest.m3u8" type="application/x-mpegURL" />
          {/* <source src="https://archive.org/download/ElephantsDream/ed_hd.ogv" type="video/ogg" /> */}
        </video>
    )
  }