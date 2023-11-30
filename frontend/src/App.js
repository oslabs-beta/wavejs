import React from 'react';
import ShakaPlayer from 'shaka-player-react';
import { browserName, browserVersion } from "react-device-detect";;


export default function App() {

    return (
      <div>
        <ReactHeader />
        <ReactBody />
        {browserName === 'Safari'?
        <VideoDisplay /> :
        <ShakaPlayer autoPlay src="http://localhost:3000/video/test/manifest.mpd" crossorigin="anonymous" />}
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
          <source src="http://localhost:3000/video/test/manifest.m3u8" type="application/x-mpegURL" />
          {/* <source src="https://archive.org/download/ElephantsDream/ed_hd.ogv" type="video/ogg" /> */}
        </video>
    )
  }