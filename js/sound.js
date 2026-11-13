'use strict';
/* ───────────── generated audio: ambience + chimes (no audio files) ───────────── */

const Sound = (() => {
  let ctx = null, master = null, live = [], current = 'off';
  const AMBIENCES = [['off', 'Silence'], ['rain', 'Rain'], ['brown', 'Deep noise'], ['waves', 'Waves'], ['white', 'White noise']];

  function ac() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(type) {
    const c = ac(), len = c.sampleRate * 5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w * 0.5;
      else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.4; }
      else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
    /* crossfade the loop seam */
    const f = Math.floor(c.sampleRate * 0.25);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[len - f + i] * (1 - k); }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.loopEnd = (len - f) / c.sampleRate;
    return src;
  }
  function chain(src, ...nodes) { let n = src; for (const x of nodes) { n.connect(x); n = x; } n.connect(master); src.start(); live.push(src); }
  function filter(type, freq, q = 0.7) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }

  function stop() {
    if (master && ctx) {
      const m = master, l = live;
      m.gain.cancelScheduledValues(ctx.currentTime); m.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { l.forEach(s => { try { s.stop(); } catch (e) {} }); m.disconnect(); }, 700);
    }
    master = null; live = []; current = 'off';
  }
  function play(kind, vol = 0.5) {
    if (kind === current && master) { setVolume(vol); return; }
    stop();
    if (kind === 'off' || !ac()) return;
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    if (kind === 'white') chain(noise('white'), filter('lowpass', 9000), gain(0.35));
    if (kind === 'brown') chain(noise('brown'), filter('lowpass', 900), gain(0.9));
    if (kind === 'rain') {
      chain(noise('pink'), filter('highpass', 500), filter('lowpass', 7500), gain(0.9));
      chain(noise('brown'), filter('lowpass', 300), gain(0.5));
    }
    if (kind === 'waves') {
      const g = gain(0.5), lfo = ctx.createOscillator(), depth = gain(0.42);
      lfo.frequency.value = 0.11; lfo.connect(depth); depth.connect(g.gain); lfo.start(); live.push(lfo);
      chain(noise('brown'), filter('lowpass', 650), g);
      chain(noise('pink'), filter('highpass', 1800), gain(0.08));
    }
    current = kind;
    master.gain.setTargetAtTime(vol, ctx.currentTime, 0.4);
  }
  function setVolume(v) { if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.08); }

  function tone(freq, at, dur, vol = 0.16, type = 'sine') {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + at);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g); g.connect(c.destination); o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.05);
  }
  const enabled = () => state.settings.sound;
  return {
    AMBIENCES, play, stop, setVolume,
    get current() { return current; },
    chime() { if (!enabled()) return; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.16, 1.1)); },
    soft() { if (!enabled()) return; [783.99, 587.33].forEach((f, i) => tone(f, i * 0.2, 0.9, 0.12)); },
    tick() { if (!enabled()) return; tone(880, 0, 0.12, 0.07, 'triangle'); tone(1318.5, 0.07, 0.18, 0.06, 'triangle'); },
  };
})();
