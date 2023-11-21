import React from 'react'
//<iframe width="560" height="315" src="https://www.youtube.com/embed/qWNQUvIk954?si=JXgJJpEGUwkYjDWC" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{display:"block", margin:"auto"}}></iframe>
export default function App() {
    return (
      <div>
        <h1 style={{display:"flex", alignItems:"center", justifyContent:"space-around"}}>Front End Proof of Concept</h1>
        <hr/>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-around"}}>We're putting a video player here</div>
        <video width="620" controls src="https://archive.org/download/ElephantsDream/ed_hd.ogv" type="video/ogg" style={{display:"block", marginLeft:"auto", marginRight:"auto"}}>
            
        </video>
      </div>
    );
  }