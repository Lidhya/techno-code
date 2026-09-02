/* =============================================================================
   TECHNO-CODE — procedural 4-on-the-floor engine
   All tones are synthesized (oscillators, noise buffers, filters, envelopes).
   No samples, no audio libraries.
   ============================================================================= */

(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants — timing, defaults, and musical material.
  // 16 steps = one 4/4 bar of 16th notes. Acid riff lives in A minor.
  // ---------------------------------------------------------------------------
  const STEPS = 16;
  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.12;
  const DEFAULT_BPM = 132;
  const MIN_BPM = 120;
  const MAX_BPM = 150;
  const NEAR_SILENCE = 0.0008;
  const BUS_SCROLL_MAX = 16;

  const A2 = 110;
  const C3 = 130.81;
  const D3 = 146.83;
  const E3 = 164.81;
  const G2 = 98;
  const G3 = 196;
  const A3 = 220;
  const E2 = 82.41;

  const ACID_SCALE = [G2, A2, C3, D3, E3, G3, A3];

  const TRACKS = [
    { id: "kick", name: "KICK", color: "#ff2bd6" },
    { id: "sub", name: "SUB", color: "#7c5cff" },
    { id: "closedHat", name: "CH HAT", color: "#00e5ff" },
    { id: "openHat", name: "OH HAT", color: "#2dffc4" },
    { id: "clap", name: "CLAP", color: "#ffc400" },
    { id: "acid", name: "ACID", color: "#c6ff00" },
  ];

  // ---------------------------------------------------------------------------
  // Pattern library — authentic techno skeletons the generator can load or mutate.
  // ---------------------------------------------------------------------------
  const PRESETS = {
    warehouse: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      sub: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
      closedHat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      openHat: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
      clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      acid: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1],
      notes: [A2, A2, C3, A2, E3, D3, A2, G3, A2, A2, C3, G2, E3, D3, A3, G3],
    },
    berlin: {
      kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],
      sub: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
      closedHat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1],
      openHat: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      acid: [1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1],
      notes: [A2, A2, A2, C3, A2, A2, E3, E3, D3, C3, A2, A2, G2, G2, A2, E2],
    },
    industrial: {
      kick: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
      sub: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      closedHat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
      openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      clap: [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
      acid: [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
      notes: [E2, A2, A2, C3, E2, D3, A2, A2, E3, A2, C3, G2, A2, D3, G3, A3],
    },
    detroit: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      sub: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1],
      closedHat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
      openHat: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      acid: [1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0],
      notes: [A2, C3, E3, A2, A3, G3, E3, D3, C3, A2, G2, A2, E3, D3, C3, A2],
    },
  };

  // ---------------------------------------------------------------------------
  // Engine state — AudioContext is created lazily on first Play (autoplay policy).
  // ---------------------------------------------------------------------------
  const state = {
    ctx: null,
    playing: false,
    bpm: DEFAULT_BPM,
    swing: 0.08,
    currentStep: 0,
    nextStepTime: 0,
    timerId: null,
    delayDivision: 8,
    muted: Object.fromEntries(TRACKS.map((track) => [track.id, false])),
    pattern: clonePattern(PRESETS.warehouse),
    notes: PRESETS.warehouse.notes.slice(),
    openHatGain: null,
    busStep: -1,
  };

  // Terminal feed for the master-bus overlay. Pattern bits stay in sync with the grid.
  const busLog = [];

  const params = {
    master: 0.75,
    cutoff: 900,
    resonance: 12,
    drive: 0.28,
    reverb: 0.22,
    feedback: 0.35,
  };

  const nodes = {};

  // ---------------------------------------------------------------------------
  // Pattern helpers
  // ---------------------------------------------------------------------------
  function clonePattern(preset) {
    const pattern = {};
    TRACKS.forEach((track) => {
      pattern[track.id] = preset[track.id].slice();
    });
    return pattern;
  }

  function emptyPattern() {
    const pattern = {};
    TRACKS.forEach((track) => {
      pattern[track.id] = new Array(STEPS).fill(0);
    });
    return pattern;
  }

  /**
   * Build a new 4-on-the-floor skeleton with randomized groove / acid notes.
   * Kick stays on the quarter notes so the result still reads as techno.
   */
  function generatePattern() {
    const pattern = emptyPattern();
    pattern.kick = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    if (Math.random() < 0.35) pattern.kick[14] = 1;
    if (Math.random() < 0.25) pattern.kick[3] = 1;

    for (let i = 0; i < STEPS; i += 1) {
      pattern.closedHat[i] = i % 2 === 1 && Math.random() < 0.92 ? 1 : Math.random() < 0.12 ? 1 : 0;
      pattern.sub[i] = i % 4 === 2 || (i % 8 === 6 && Math.random() < 0.7) ? 1 : 0;
      pattern.acid[i] = Math.random() < 0.45 ? 1 : 0;
    }

    pattern.openHat[7] = 1;
    pattern.openHat[15] = Math.random() < 0.8 ? 1 : 0;
    pattern.clap[4] = 1;
    pattern.clap[12] = 1;
    if (Math.random() < 0.3) pattern.clap[10] = 1;

    const notes = new Array(STEPS).fill(A2).map(() => ACID_SCALE[Math.floor(Math.random() * ACID_SCALE.length)]);
    return { pattern, notes };
  }

  // ---------------------------------------------------------------------------
  // DSP utilities
  // ---------------------------------------------------------------------------

  /**
   * Soft-clip waveshaper. Amount 0–1 maps to a mild industrial saturation curve.
   * Used on kick punch and the acid lead so they sit in a warehouse mix.
   */
  function makeDistortionCurve(amount) {
    const k = amount * 40;
    const samples = 2048;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Stereo decaying-noise impulse. Cheap algorithmic "warehouse" convolution.
   * Left/right are generated independently so the tail has width.
   */
  function createImpulseResponse(ctx, duration, decay) {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
      }
    }
    return impulse;
  }

  function createNoiseBuffer(ctx) {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function noiseSource(ctx, buffer) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function expGain(gainParam, time, peak, duration) {
    gainParam.setValueAtTime(NEAR_SILENCE, time);
    gainParam.exponentialRampToValueAtTime(Math.max(peak, NEAR_SILENCE), time + 0.004);
    gainParam.exponentialRampToValueAtTime(NEAR_SILENCE, time + duration);
  }

  function disposeOnEnded(source, ...graphNodes) {
    source.onended = () => {
      graphNodes.forEach((node) => {
        try {
          node.disconnect();
        } catch (error) {
          // Node may already be disconnected after a graph rebuild.
        }
      });
    };
  }

  function sixteenthDuration() {
    return 60 / state.bpm / 4;
  }

  function delayTimeForDivision() {
    const beat = 60 / state.bpm;
    return state.delayDivision === 8 ? beat * 0.5 : beat * 0.25;
  }

  // ---------------------------------------------------------------------------
  // Audio graph
  //
  //   instruments ─┬─ dry ──────────────┐
  //                ├─ delay send ─ stereo delay ─┤
  //                └─ reverb send ─ convolver ───┼─ masterGain ─ limiter ─ out
  //   sub ─ sidechainGain ─ dry / reverb ────────┘
  // ---------------------------------------------------------------------------
  function buildGraph(ctx) {
    const masterGain = ctx.createGain();
    masterGain.gain.value = params.master;

    // Brick-wall-ish limiter so the 909-style kick cannot clip the destination.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0.5;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;

    masterGain.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);

    const kickDrive = ctx.createWaveShaper();
    kickDrive.curve = makeDistortionCurve(params.drive);
    kickDrive.oversample = "2x";
    const kickGain = ctx.createGain();
    kickGain.gain.value = 0.95;
    kickDrive.connect(kickGain);
    kickGain.connect(masterGain);

    const sidechainGain = ctx.createGain();
    sidechainGain.gain.value = 1;
    const subOut = ctx.createGain();
    subOut.gain.value = 0.55;
    sidechainGain.connect(subOut);
    subOut.connect(masterGain);

    const hatGain = ctx.createGain();
    hatGain.gain.value = 0.28;
    hatGain.connect(masterGain);

    const clapGain = ctx.createGain();
    clapGain.gain.value = 0.42;
    clapGain.connect(masterGain);

    const acidFilter = ctx.createBiquadFilter();
    acidFilter.type = "lowpass";
    acidFilter.frequency.value = params.cutoff;
    acidFilter.Q.value = params.resonance;

    const acidDrive = ctx.createWaveShaper();
    acidDrive.curve = makeDistortionCurve(params.drive * 0.85);
    acidDrive.oversample = "2x";

    const acidOut = ctx.createGain();
    acidOut.gain.value = 0.22;
    acidFilter.connect(acidDrive);
    acidDrive.connect(acidOut);
    acidOut.connect(masterGain);

    // Slow LFO keeps the 303 filter breathing between note envelopes.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.22;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(acidFilter.frequency);
    lfo.start();

    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.35;
    const delayL = ctx.createDelay(1.5);
    const delayR = ctx.createDelay(1.5);
    const fbL = ctx.createGain();
    const fbR = ctx.createGain();
    fbL.gain.value = params.feedback;
    fbR.gain.value = params.feedback;
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    panL.pan.value = -0.85;
    panR.pan.value = 0.85;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.28;

    const delayTime = delayTimeForDivision();
    delayL.delayTime.value = delayTime;
    delayR.delayTime.value = delayTime * 1.5;

    delaySend.connect(delayL);
    delayL.connect(fbL);
    fbL.connect(delayR);
    delayR.connect(fbR);
    fbR.connect(delayL);
    delayL.connect(panL);
    delayR.connect(panR);
    panL.connect(delayWet);
    panR.connect(delayWet);
    delayWet.connect(masterGain);

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = params.reverb;
    const convolver = ctx.createConvolver();
    convolver.buffer = createImpulseResponse(ctx, 1.8, 2.4);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.9;
    reverbSend.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(masterGain);

    acidOut.connect(delaySend);
    clapGain.connect(delaySend);
    hatGain.connect(delaySend);
    acidOut.connect(reverbSend);
    clapGain.connect(reverbSend);
    hatGain.connect(reverbSend);
    subOut.connect(reverbSend);

    Object.assign(nodes, {
      masterGain,
      limiter,
      analyser,
      kickDrive,
      kickGain,
      sidechainGain,
      subOut,
      hatGain,
      clapGain,
      acidFilter,
      acidDrive,
      acidOut,
      delaySend,
      delayL,
      delayR,
      fbL,
      fbR,
      delayWet,
      reverbSend,
      convolver,
      noise: createNoiseBuffer(ctx),
    });
  }

  function ensureAudio() {
    if (state.ctx) return state.ctx;
    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive",
    });
    state.ctx = ctx;
    buildGraph(ctx);
    return ctx;
  }

  function applyLiveParams() {
    if (!state.ctx) return;
    nodes.masterGain.gain.setTargetAtTime(params.master, state.ctx.currentTime, 0.03);
    nodes.acidFilter.frequency.setTargetAtTime(params.cutoff, state.ctx.currentTime, 0.04);
    nodes.acidFilter.Q.setTargetAtTime(params.resonance, state.ctx.currentTime, 0.04);
    nodes.reverbSend.gain.setTargetAtTime(params.reverb, state.ctx.currentTime, 0.05);
    nodes.fbL.gain.setTargetAtTime(params.feedback, state.ctx.currentTime, 0.04);
    nodes.fbR.gain.setTargetAtTime(params.feedback, state.ctx.currentTime, 0.04);
    nodes.kickDrive.curve = makeDistortionCurve(params.drive);
    nodes.acidDrive.curve = makeDistortionCurve(params.drive * 0.85);
    syncDelayTime();
  }

  function syncDelayTime() {
    if (!state.ctx) return;
    const time = delayTimeForDivision();
    const now = state.ctx.currentTime;
    nodes.delayL.delayTime.setTargetAtTime(time, now, 0.05);
    nodes.delayR.delayTime.setTargetAtTime(time * 1.5, now, 0.05);
  }

  // ---------------------------------------------------------------------------
  // Voices — each hit is a short-lived subgraph scheduled in the audio clock.
  // ---------------------------------------------------------------------------

  /**
   * 909-style kick: sine pitch drop (body) + tiny square click (beater).
   * Pitch envelope ~150Hz → 45Hz in 100ms; amplitude decays exponentially.
   */
  function playKick(time) {
    const ctx = state.ctx;
    const osc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);
    bodyGain.gain.setValueAtTime(1, time);
    bodyGain.gain.exponentialRampToValueAtTime(NEAR_SILENCE, time + 0.46);
    osc.connect(bodyGain);
    bodyGain.connect(nodes.kickDrive);
    osc.start(time);
    osc.stop(time + 0.5);

    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(78, time);
    clickGain.gain.setValueAtTime(0.22, time);
    clickGain.gain.exponentialRampToValueAtTime(NEAR_SILENCE, time + 0.018);
    click.connect(clickGain);
    clickGain.connect(nodes.kickDrive);
    click.start(time);
    click.stop(time + 0.03);

    disposeOnEnded(osc, osc, bodyGain);
    disposeOnEnded(click, click, clickGain);
    duckSub(time);
  }

  /**
   * Sidechain pump: every kick ducks the sub bus, then releases into the next beat.
   * Attack is fast so the kick punch stays clear; release ~300ms for classic pumping.
   */
  function duckSub(time) {
    const gain = nodes.sidechainGain.gain;
    const release = Math.min(0.32, (60 / state.bpm) * 0.85);
    gain.cancelScheduledValues(time);
    gain.setValueAtTime(Math.max(gain.value, 0.001), time);
    gain.linearRampToValueAtTime(0.12, time + 0.018);
    gain.exponentialRampToValueAtTime(1, time + release);
  }

  /**
   * Rumbling off-beat sub: low-passed saw, short notes, lives on the ducked bus.
   */
  function playSub(time, step) {
    const ctx = state.ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const freq = step % 8 === 6 ? E2 : 55;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, time);
    filter.Q.value = 6;
    expGain(gain.gain, time, 0.7, 0.38);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(nodes.sidechainGain);
    osc.start(time);
    osc.stop(time + 0.42);
    disposeOnEnded(osc, osc, filter, gain);
  }

  function playNoiseBurst(time, { highpass, bandpass, q, peak, decay, pan, dest }) {
    const ctx = state.ctx;
    const source = noiseSource(ctx, nodes.noise);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    filter.type = bandpass ? "bandpass" : "highpass";
    filter.frequency.value = bandpass || highpass;
    filter.Q.value = q;
    panner.pan.value = pan || 0;
    expGain(gain.gain, time, peak, decay);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(dest);
    const offset = Math.random() * 1.4;
    source.start(time, offset);
    source.stop(time + decay + 0.02);
    disposeOnEnded(source, source, filter, gain, panner);
    return gain;
  }

  function chokeOpenHat(time) {
    if (!state.openHatGain) return;
    state.openHatGain.gain.cancelScheduledValues(time);
    state.openHatGain.gain.setValueAtTime(Math.max(state.openHatGain.gain.value, NEAR_SILENCE), time);
    state.openHatGain.gain.exponentialRampToValueAtTime(NEAR_SILENCE, time + 0.02);
  }

  function playClosedHat(time) {
    chokeOpenHat(time);
    playNoiseBurst(time, {
      highpass: 7000,
      q: 0.9,
      peak: 0.55,
      decay: 0.045,
      pan: -0.15,
      dest: nodes.hatGain,
    });
  }

  function playOpenHat(time) {
    chokeOpenHat(time);
    const gain = playNoiseBurst(time, {
      highpass: 6800,
      q: 0.8,
      peak: 0.42,
      decay: 0.22,
      pan: 0.2,
      dest: nodes.hatGain,
    });
    state.openHatGain = gain;
  }

  /**
   * Clap / snare hybrid: stacked band-passed noise bursts (classic drum-machine clap)
   * plus a short mid sine for body.
   */
  function playClap(time) {
    const bursts = [0, 0.012, 0.024, 0.041];
    bursts.forEach((offset, index) => {
      playNoiseBurst(time + offset, {
        bandpass: 1100 + index * 90,
        q: 1.1,
        peak: 0.7 - index * 0.12,
        decay: 0.16,
        pan: index % 2 === 0 ? -0.25 : 0.25,
        dest: nodes.clapGain,
      });
    });

    const ctx = state.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(140, time + 0.08);
    expGain(gain.gain, time, 0.28, 0.12);
    osc.connect(gain);
    gain.connect(nodes.clapGain);
    osc.start(time);
    osc.stop(time + 0.14);
    disposeOnEnded(osc, osc, gain);
  }

  /**
   * Resonant saw lead through the shared modulated LPF (303-style).
   * Each note retriggers a cutoff envelope on the shared filter.
   */
  function playAcid(time, freq) {
    const ctx = state.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    expGain(gain.gain, time, 0.85, 0.18);
    osc.connect(gain);
    gain.connect(nodes.acidFilter);
    osc.start(time);
    osc.stop(time + 0.22);
    disposeOnEnded(osc, osc, gain);

    const cutoff = params.cutoff;
    const peak = Math.min(cutoff * 3.2, 9000);
    const floor = Math.max(cutoff * 0.55, 80);
    nodes.acidFilter.frequency.cancelScheduledValues(time);
    nodes.acidFilter.frequency.setValueAtTime(peak, time);
    nodes.acidFilter.frequency.exponentialRampToValueAtTime(floor, time + 0.16);
  }

  // ---------------------------------------------------------------------------
  // Sequencer — look-ahead scheduler (Chris Wilson pattern) so timing stays
  // sample-accurate even when the main thread is busy painting the playhead.
  // ---------------------------------------------------------------------------
  function stepDuration(stepIndex) {
    const base = sixteenthDuration();
    if (state.swing <= 0) return base;
    return stepIndex % 2 === 0 ? base * (1 + state.swing) : base * (1 - state.swing);
  }

  function triggerStep(step, time) {
    const pattern = state.pattern;
    if (pattern.kick[step] && !state.muted.kick) playKick(time);
    if (pattern.sub[step] && !state.muted.sub) playSub(time, step);
    if (pattern.closedHat[step] && !state.muted.closedHat) playClosedHat(time);
    if (pattern.openHat[step] && !state.muted.openHat) playOpenHat(time);
    if (pattern.clap[step] && !state.muted.clap) playClap(time);
    if (pattern.acid[step] && !state.muted.acid) playAcid(time, state.notes[step] || A2);
  }

  function scheduleVisual(step, time) {
    const delay = Math.max(0, (time - state.ctx.currentTime) * 1000);
    window.setTimeout(() => {
      highlightPlayhead(step);
      logBusStep(step);
    }, delay);
  }

  function scheduler() {
    const ctx = state.ctx;
    while (state.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const step = state.currentStep;
      const time = state.nextStepTime;
      triggerStep(step, time);
      scheduleVisual(step, time);
      state.nextStepTime += stepDuration(step);
      state.currentStep = (step + 1) % STEPS;
    }
    state.timerId = window.setTimeout(scheduler, LOOKAHEAD_MS);
  }

  async function start() {
    const ctx = ensureAudio();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    state.playing = true;
    state.currentStep = 0;
    state.nextStepTime = ctx.currentTime + 0.06;
    pushBusLine("RUN bpm=" + state.bpm + " " + packedPatternBits());
    scheduler();
    startVisualizer();
    syncPlayButton();
  }

  function stop() {
    state.playing = false;
    if (state.timerId) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }
    highlightPlayhead(-1);
    state.busStep = -1;
    pushBusLine("STP " + packedPatternBits());
    syncPlayButton();
  }

  async function togglePlay() {
    if (state.playing) {
      stop();
      return;
    }
    await start();
  }

  // ---------------------------------------------------------------------------
  // UI — grid, readouts, visualizer
  // ---------------------------------------------------------------------------
  const els = {
    playBtn: document.getElementById("play-btn"),
    playLabel: document.querySelector(".play-label"),
    grid: document.getElementById("grid"),
    ruler: document.getElementById("step-ruler"),
    preset: document.getElementById("preset"),
    generateBtn: document.getElementById("generate-btn"),
    clearBtn: document.getElementById("clear-btn"),
    canvas: document.getElementById("visualizer"),
    busCode: document.getElementById("bus-code"),
    bpm: document.getElementById("bpm"),
    bpmReadout: document.getElementById("bpm-readout"),
    master: document.getElementById("master"),
    masterReadout: document.getElementById("master-readout"),
    cutoff: document.getElementById("cutoff"),
    cutoffReadout: document.getElementById("cutoff-readout"),
    resonance: document.getElementById("resonance"),
    resonanceReadout: document.getElementById("resonance-readout"),
    drive: document.getElementById("drive"),
    driveReadout: document.getElementById("drive-readout"),
    swing: document.getElementById("swing"),
    swingReadout: document.getElementById("swing-readout"),
    reverb: document.getElementById("reverb"),
    reverbReadout: document.getElementById("reverb-readout"),
    feedback: document.getElementById("feedback"),
    feedbackReadout: document.getElementById("feedback-readout"),
  };

  function renderRuler() {
    els.ruler.innerHTML = "<div></div>";
    for (let i = 0; i < STEPS; i += 1) {
      const cell = document.createElement("div");
      cell.className = "step-num" + (i % 4 === 0 ? " downbeat" : "");
      cell.textContent = String(i + 1);
      els.ruler.appendChild(cell);
    }
  }

  function renderGrid() {
    els.grid.innerHTML = "";
    TRACKS.forEach((track) => {
      const row = document.createElement("div");
      row.className = "grid-row";
      row.setAttribute("role", "row");

      const meta = document.createElement("div");
      meta.className = "track-meta";

      const mute = document.createElement("button");
      mute.type = "button";
      mute.className = "mute-btn" + (state.muted[track.id] ? " is-muted" : "");
      mute.textContent = "M";
      mute.setAttribute("aria-pressed", String(state.muted[track.id]));
      mute.setAttribute("aria-label", "Mute " + track.name);
      mute.addEventListener("click", () => {
        state.muted[track.id] = !state.muted[track.id];
        mute.classList.toggle("is-muted", state.muted[track.id]);
        mute.setAttribute("aria-pressed", String(state.muted[track.id]));
        pushBusLine("MUTE " + track.id + "=" + (state.muted[track.id] ? "1" : "0") + " " + trackBits(track.id));
      });

      const name = document.createElement("span");
      name.className = "track-name";
      name.textContent = track.name;
      name.style.color = track.color;

      meta.append(mute, name);
      row.appendChild(meta);

      for (let i = 0; i < STEPS; i += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "step" + (i % 4 === 0 ? " downbeat" : "");
        btn.style.setProperty("--led", track.color);
        btn.dataset.track = track.id;
        btn.dataset.step = String(i);
        btn.setAttribute("role", "gridcell");
        btn.setAttribute("aria-label", track.name + " step " + (i + 1));
        const on = Boolean(state.pattern[track.id][i]);
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", String(on));
        row.appendChild(btn);
      }

      els.grid.appendChild(row);
    });
  }

  function setStepCell(btn, trackId, step, value) {
    if (state.pattern[trackId][step] === value) return;
    state.pattern[trackId][step] = value;
    btn.classList.toggle("on", Boolean(value));
    btn.setAttribute("aria-pressed", String(Boolean(value)));
    pushBusLine("WR " + trackId + "[" + step + "]=" + value + " " + trackBits(trackId));
  }

  function bindGridPaint() {
    let paintValue = null;

    els.grid.addEventListener("pointerdown", (event) => {
      const btn = event.target.closest(".step");
      if (!btn) return;
      event.preventDefault();
      const trackId = btn.dataset.track;
      const step = Number(btn.dataset.step);
      paintValue = state.pattern[trackId][step] ? 0 : 1;
      setStepCell(btn, trackId, step, paintValue);
      els.grid.setPointerCapture(event.pointerId);
    });

    els.grid.addEventListener("pointermove", (event) => {
      if (paintValue === null) return;
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const btn = under && under.closest ? under.closest(".step") : null;
      if (!btn || !els.grid.contains(btn)) return;
      setStepCell(btn, btn.dataset.track, Number(btn.dataset.step), paintValue);
    });

    const endPaint = () => {
      paintValue = null;
    };
    els.grid.addEventListener("pointerup", endPaint);
    els.grid.addEventListener("pointercancel", endPaint);
  }

  function highlightPlayhead(step) {
    document.querySelectorAll(".step.is-playhead").forEach((cell) => {
      cell.classList.remove("is-playhead");
    });
    if (step < 0) return;
    document.querySelectorAll('.step[data-step="' + step + '"]').forEach((cell) => {
      cell.classList.add("is-playhead");
    });
  }

  function syncPlayButton() {
    els.playBtn.classList.toggle("is-playing", state.playing);
    els.playBtn.setAttribute("aria-pressed", String(state.playing));
    els.playLabel.textContent = state.playing ? "STOP" : "PLAY";
  }

  function loadPreset(name) {
    const preset = PRESETS[name] || PRESETS.warehouse;
    state.pattern = clonePattern(preset);
    state.notes = preset.notes.slice();
    renderGrid();
    pushBusLine("LOAD " + name + " " + packedPatternBits());
  }

  // ---------------------------------------------------------------------------
  // Master-bus terminal overlay.
  // Frequency bars stay on the canvas; this layer prints live 0/1 pattern data
  // so sequencer edits and playhead motion are visible as a scrolling dump.
  // ---------------------------------------------------------------------------
  function trackBits(trackId) {
    return state.pattern[trackId].join("");
  }

  function packedPatternBits() {
    return TRACKS.map((track) => trackBits(track.id)).join(" ");
  }

  function groupBits(bits, size) {
    const chunks = [];
    for (let i = 0; i < bits.length; i += size) {
      chunks.push(bits.slice(i, i + size));
    }
    return chunks.join(" ");
  }

  function hitMask(step) {
    return TRACKS.map((track) => {
      const armed = state.pattern[track.id][step] && !state.muted[track.id];
      return armed ? "1" : "0";
    }).join("");
  }

  function matrixBlock() {
    return TRACKS.map((track) => {
      const mute = state.muted[track.id] ? "M" : ".";
      return track.name.padEnd(7, " ") + " " + mute + " " + trackBits(track.id);
    }).join("\n");
  }

  function pushBusLine(line) {
    busLog.push(line);
    if (busLog.length > BUS_SCROLL_MAX) {
      busLog.shift();
    }
    renderBusOverlay();
  }

  function logBusStep(step) {
    state.busStep = step;
    const mask = hitMask(step);
    const dump = groupBits(packedPatternBits().replace(/ /g, ""), 8);
    const acidHit = state.pattern.acid[step] && !state.muted.acid;
    const noteTag = acidHit ? " n=" + Math.round(state.notes[step] || A2) : "";
    pushBusLine(
      "s" + String(step + 1).padStart(2, "0") + " " + mask + " " + dump + noteTag
    );
  }

  function renderBusOverlay() {
    if (!els.busCode) return;
    const stepIndex = state.busStep < 0 ? 0 : state.busStep;
    const status = state.playing
      ? "RUN bpm=" + state.bpm + " step=" + String(stepIndex + 1).padStart(2, "0")
      : "IDL bpm=" + state.bpm;
    // Caret sits under the 16-bit rows: 7-char name + space + mute + space.
    const caret = state.busStep >= 0 ? " ".repeat(10 + state.busStep) + "^" : "";
    const scroll = busLog.length
      ? busLog.join("\n")
      : groupBits(packedPatternBits().replace(/ /g, ""), 8);
    els.busCode.textContent = status + "\n" + matrixBlock() + (caret ? "\n" + caret : "") + "\n" + scroll;
  }

  // ---------------------------------------------------------------------------
  // Master-bus visualizer — frequency bars tinted cyan → magenta.
  // ---------------------------------------------------------------------------
  let vizRaf = 0;
  const vizCtx = els.canvas.getContext("2d");
  const freqData = new Uint8Array(128);

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = els.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (els.canvas.width !== width || els.canvas.height !== height) {
      els.canvas.width = width;
      els.canvas.height = height;
    }
  }

  function startVisualizer() {
    if (vizRaf) return;
    sizeCanvas();
    const draw = () => {
      const { width, height } = els.canvas;
      vizCtx.clearRect(0, 0, width, height);
      vizCtx.fillStyle = "#000000";
      vizCtx.fillRect(0, 0, width, height);

      if (nodes.analyser) {
        nodes.analyser.getByteFrequencyData(freqData);
        const bars = 48;
        const gap = 2;
        const barW = (width - gap * bars) / bars;
        for (let i = 0; i < bars; i += 1) {
          const mag = freqData[i] / 255;
          const h = Math.max(2, mag * (height - 8));
          const x = i * (barW + gap);
          const t = i / bars;
          vizCtx.fillStyle = t < 0.5
            ? "rgba(0, 229, 255, " + (0.35 + mag * 0.65) + ")"
            : "rgba(255, 43, 214, " + (0.35 + mag * 0.65) + ")";
          vizCtx.fillRect(x, height - h - 4, barW, h);
        }
      }

      vizRaf = window.requestAnimationFrame(draw);
    };
    draw();
  }

  function bindControls() {
    els.playBtn.addEventListener("click", () => {
      togglePlay();
    });

    document.addEventListener("keydown", (event) => {
      if (event.code !== "Space") return;
      const tag = event.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON" || tag === "TEXTAREA") return;
      event.preventDefault();
      togglePlay();
    });

    els.bpm.addEventListener("input", () => {
      const bpm = clamp(Number(els.bpm.value), MIN_BPM, MAX_BPM);
      state.bpm = bpm;
      els.bpmReadout.textContent = String(bpm);
      syncDelayTime();
      renderBusOverlay();
    });

    els.master.addEventListener("input", () => {
      params.master = Number(els.master.value) / 100;
      els.masterReadout.textContent = els.master.value + "%";
      applyLiveParams();
    });

    els.cutoff.addEventListener("input", () => {
      params.cutoff = Number(els.cutoff.value);
      els.cutoffReadout.textContent = params.cutoff + " Hz";
      applyLiveParams();
    });

    els.resonance.addEventListener("input", () => {
      params.resonance = Number(els.resonance.value);
      els.resonanceReadout.textContent = params.resonance.toFixed(1);
      applyLiveParams();
    });

    els.drive.addEventListener("input", () => {
      params.drive = Number(els.drive.value) / 100;
      els.driveReadout.textContent = els.drive.value + "%";
      applyLiveParams();
    });

    els.swing.addEventListener("input", () => {
      state.swing = Number(els.swing.value) / 100;
      els.swingReadout.textContent = els.swing.value + "%";
    });

    els.reverb.addEventListener("input", () => {
      params.reverb = Number(els.reverb.value) / 100;
      els.reverbReadout.textContent = els.reverb.value + "%";
      applyLiveParams();
    });

    els.feedback.addEventListener("input", () => {
      params.feedback = Number(els.feedback.value) / 100;
      els.feedbackReadout.textContent = els.feedback.value + "%";
      applyLiveParams();
    });

    document.querySelectorAll(".sync-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".sync-btn").forEach((other) => {
          other.classList.remove("is-active");
          other.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        state.delayDivision = Number(btn.dataset.division);
        syncDelayTime();
      });
    });

    els.preset.addEventListener("change", () => {
      loadPreset(els.preset.value);
    });

    els.generateBtn.addEventListener("click", () => {
      const generated = generatePattern();
      state.pattern = generated.pattern;
      state.notes = generated.notes;
      renderGrid();
      pushBusLine("GEN " + packedPatternBits());
    });

    els.clearBtn.addEventListener("click", () => {
      state.pattern = emptyPattern();
      renderGrid();
      pushBusLine("CLR " + packedPatternBits());
    });

    bindGridPaint();
    window.addEventListener("resize", sizeCanvas);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  renderRuler();
  renderGrid();
  bindControls();
  renderBusOverlay();
})();
