// Synthesised WebAudio sound for Solmar Bay: no audio files, nothing
// loaded over the network. Engine hum, police siren, gunshots, pickups and
// a low bass music loop, all from oscillators and noise buffers.
export function createAudio() {
  let ctx = null, master = null, muted = false, engineOsc = null, engineGain = null;
  let musicTimer = null, musicStep = 0;
  const BASS = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch { return false; }
    return true;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEngine(speed01) { if (ensure() && !muted) { engineOsc.frequency.value = 50 + speed01 * 140; engineGain.gain.value = 0.02 + speed01 * 0.05; } },
    stopEngine() { if (engineGain) engineGain.gain.value = 0; },
    shoot() { noise(0.12, 0.4, 2400); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.25, 500); },
    pickup() { tone(880, 0.12, 'sine', 0.2); tone(1320, 0.18, 'sine', 0.18); },
    cash() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.1, 'sine', 0.2); tone(1320, 0.22, 'sine', 0.2); },
    siren() { tone(700, 0.5, 'sine', 0.07, 950); },
    crash() { noise(0.25, 0.4, 700); },
    busted() { tone(440, 0.3, 'sawtooth', 0.15, 220); tone(330, 0.5, 'sawtooth', 0.15, 165); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 110)); },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const f = BASS[musicStep % BASS.length];
        if (f) tone(f, 0.42, 'triangle', 0.16);
        if (musicStep % 4 === 2) noise(0.05, 0.08, 6000);
        musicStep += 1;
      }, 210);
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.35; return muted; },
    get muted() { return muted; },
  };
}
