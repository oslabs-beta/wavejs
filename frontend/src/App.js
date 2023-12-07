import React, { useRef, useEffect } from 'react';
import ShakaPlayer from 'shaka-player-react';
import { browserName } from 'react-device-detect';

export default function App() {
  return (
    <div>
      <h1
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        Front End Proof of Concept
      </h1>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        We're putting a video player here
      </div>

      {browserName === 'Safari' ? <HLSVideo /> : <ShakaWrapper />}
    </div>
  );
}

function HLSVideo() {
  return (
    <video
      width="620"
      controls
      autoPlay
      style={{
        display: 'block',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <source
        src="http://localhost:3000/wavejs/TestUser/manifest.m3u8"
        //src="http://localhost:3000/wavejs/mvp-demo/manifest.m3u8"
        type="application/x-mpegURL"
      />
      {/* <source src="https://archive.org/download/ElephantsDream/ed_hd.ogv" type="video/ogg" /> */}
    </video>
  );
}

const ShakaWrapper = () => {
  const controllerRef = useRef(null);

  useEffect(() => {
    const {
      /** @type {shaka.Player} */ player,
      /** @type {shaka.ui.Overlay} */ ui,
      /** @type {HTMLVideoElement} */ videoElement,
    } = controllerRef.current;

    async function loadAsset() {
      // Load an asset.
      //await player.load('http://localhost:3000/wavejs/TestUser/manifest.mpd');
      await player.load('http://localhost:3000/wavejs/mvp-demo/manifest.mpd');

      // Trigger play.
      videoElement.play();
    }

    loadAsset();
  }, []);

  return <ShakaPlayer ref={controllerRef} />;
};
