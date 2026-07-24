// Panda Fortune Deluxe — sound engine (Web Audio API, no external files)
// v5.1: added ambient BGM loop + tiered win fanfare
const SoundFX = (() => {
  let ctx = null;
  let muted = false;
  let bgmTimer = null;
  let bgmOn = false;

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

  const BGM_SCALE = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3];
  function bgmStep() {
    if (!bgmOn) return;
    if (!muted) {
      const note = BGM_SCALE[Math.floor(Math.random() * BGM_SCALE.length)];
      tone(note / 2, 2.2, "sine", 0.025, 0);
      if (Math.random() < 0.4) tone(note * 2, 0.9, "triangle", 0.02, 0.3);
    }
    bgmTimer = setTimeout(bgmStep, 1600 + Math.random() * 800);
  }

  return {
    spinStart() {
      tone(180, 0.35, "sawtooth", 0.06, 0, 520);
      noise(0.3, 0.05);
    },
    reelStop(i) {
      tone(140 + i * 25, 0.12, "square", 0.12);
      noise(0.06, 0.1);
    },
    win(tier) {
      const sets = [
        [523, 659, 784],
        [523, 659, 784, 1047],
        [392, 523, 659, 784, 1047, 1319],
        [330, 392, 523, 659, 784, 1047, 1319, 1568],
      ];
      const notes = sets[Math.min(tier, sets.length - 1)];
      notes.forEach((f, i) => tone(f, 0.2, "triangle", 0.15, i * 0.085));
    },
    lose() {
      tone(220, 0.15, "sine", 0.05, 0, 180);
    },
    click() {
      tone(700, 0.05, "square", 0.06);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },
    startBgm() {
      if (bgmOn) return;
      bgmOn = true;
      ensureCtx();
      clearTimeout(bgmTimer);
      bgmStep();
    },
    stopBgm() {
      bgmOn = false;
      clearTimeout(bgmTimer);
    },
  };
})();
