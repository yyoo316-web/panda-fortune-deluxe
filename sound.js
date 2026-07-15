// Panda Fortune Deluxe — sound engine (Web Audio API, no external files)
const SoundFX = (() => {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = "sine", gain = 0.15, when = 0, freqEnd = null) {
    if (muted) return;
    const c = ensureCtx();
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, gain = 0.08, when = 0) {
    if (muted) return;
    const c = ensureCtx();
    const t0 = c.currentTime + when;
    const bufferSize = c.sampleRate * dur;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    src.connect(filter).connect(g).connect(c.destination);
    src.start(t0);
  }

  return {
    spinStart() {
      // rising whoosh
      tone(180, 0.35, "sawtooth", 0.06, 0, 520);
      noise(0.3, 0.05);
    },
    reelStop(i) {
      // mechanical thunk, slightly higher pitch per reel
      tone(140 + i * 25, 0.12, "square", 0.12);
      noise(0.06, 0.1);
    },
    win(big) {
      // little fanfare arpeggio; bigger win = longer
      const notes = big ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
      notes.forEach((f, i) => tone(f, 0.18, "triangle", 0.14, i * 0.09));
    },
    lose() {
      tone(220, 0.15, "sine", 0.05, 0, 180);
    },
    click() {
      tone(700, 0.05, "square", 0.06);
    },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
  };
})();
