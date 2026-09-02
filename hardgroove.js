/* =============================================================================
   HARDGROOVE COMPOSER
   Seeded, theory-constrained generator. No full songs — only motif, groove,
   Euclidean percussion, and phrase-length arrangement.

   Maps research onto a 16-step bar:
   - Hardgroove: 4-on-the-floor kick, tribal perc, rolling hats, 138–145 BPM
   - Fred again..: tiny hook, repeat-with-lift, drop vs. breakdown
   - Beethoven: cell → repeat → invert / transpose / displace / fragment
   ============================================================================= */

(function (root) {
  "use strict";

  const STEPS = 16;
  const PHASES = ["intro", "groove", "peak", "break", "rebuild"];

  // A2 family. Minor pentatonic = club-safe; phrygian = darker warehouse.
  const SCALES = {
    pentMin: [110, 130.81, 146.83, 164.81, 196, 220, 261.63],
    dorian: [110, 123.47, 146.83, 164.81, 184.99, 220, 246.94],
    phrygian: [110, 116.54, 130.81, 146.83, 164.81, 196, 220],
  };

  const TRACK_IDS = ["kick", "sub", "closedHat", "openHat", "clap", "perc", "shaker", "acid"];

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function rng() {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
  }

  function chance(rng, p) {
    return rng() < p;
  }

  function zeros() {
    return new Array(STEPS).fill(0);
  }

  function rotate(arr, amount) {
    const n = arr.length;
    const k = ((amount % n) + n) % n;
    return arr.slice(k).concat(arr.slice(0, k));
  }

  /**
   * Euclidean rhythm (Bjorklund). Pulses are spread as evenly as possible,
   * then rotated so congas sit in the holes around the kick.
   */
  function euclidean(steps, pulses, rotation) {
    const out = zeros().slice(0, steps);
    if (pulses <= 0) return out;
    let bucket = 0;
    for (let i = 0; i < steps; i += 1) {
      bucket += pulses;
      if (bucket >= steps) {
        bucket -= steps;
        out[i] = 1;
      }
    }
    return rotate(out, rotation);
  }

  function orPatterns(a, b) {
    return a.map((bit, i) => (bit || b[i] ? 1 : 0));
  }

  function maskPattern(source, enabled) {
    return enabled ? source.slice() : zeros();
  }

  function invertDegrees(degrees, span) {
    return degrees.map((d) => (span - d + span) % span);
  }

  function phraseLength(rng, evolution) {
    const pool = evolution < 0.34
      ? [8, 16, 16, 32, 32]
      : evolution < 0.67
        ? [4, 8, 8, 16, 16]
        : [4, 4, 8, 8, 16];
    return pick(rng, pool);
  }

  // ---------------------------------------------------------------------------
  // Rhythm generator
  // ---------------------------------------------------------------------------
  function makeKick(rng, hardgroove) {
    const kick = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    // Ghost / pickup kicks — Hardgroove toughness without leaving 4/4.
    if (chance(rng, 0.25 + hardgroove * 0.45)) kick[14] = 1;
    if (chance(rng, 0.12 + hardgroove * 0.25)) kick[3] = 1;
    if (chance(rng, hardgroove * 0.2)) kick[11] = 1;
    return kick;
  }

  function makeHats(rng, groove, hardgroove) {
    const closedHat = zeros();
    const openHat = zeros();
    const offbeat = 0.72 + groove * 0.22;
    for (let i = 0; i < STEPS; i += 1) {
      if (i % 2 === 1 && chance(rng, offbeat)) closedHat[i] = 1;
      else if (chance(rng, 0.04 + groove * 0.08)) closedHat[i] = 1;
    }
    // Classic off-beat open hat; denser 8ths as hardgroove rises.
    if (hardgroove > 0.45) {
      [2, 6, 10, 14].forEach((step) => {
        openHat[step] = chance(rng, 0.75 + groove * 0.2) ? 1 : 0;
      });
    } else {
      openHat[7] = 1;
      openHat[15] = chance(rng, 0.8) ? 1 : 0;
      if (chance(rng, groove * 0.5)) openHat[3] = 1;
    }
    return { closedHat, openHat };
  }

  function makeClap(rng, groove) {
    const clap = zeros();
    clap[4] = 1;
    clap[12] = chance(rng, 0.82) ? 1 : 0;
    if (chance(rng, 0.2 + groove * 0.25)) clap[10] = 1;
    if (chance(rng, 0.12)) clap[6] = 1;
    return clap;
  }

  function makePerc(rng, hardgroove, groove) {
    const pulses = hardgroove > 0.55 ? pick(rng, [5, 7, 6]) : pick(rng, [3, 5, 5]);
    const rotation = pick(rng, [1, 2, 3, 5]);
    let perc = euclidean(STEPS, pulses, rotation);
    // Keep tribal hits out of the kick downbeats unless groove is dense.
    if (groove < 0.7) {
      perc = perc.map((bit, i) => (i % 4 === 0 ? 0 : bit));
    }
    if (chance(rng, 0.4)) perc = orPatterns(perc, euclidean(STEPS, 2, 3));
    return perc;
  }

  function makeShaker(rng, groove, hardgroove) {
    const shaker = zeros();
    const density = 0.35 + groove * 0.45 + hardgroove * 0.15;
    for (let i = 0; i < STEPS; i += 1) {
      if (i % 2 === 1 && chance(rng, density)) shaker[i] = 1;
      else if (chance(rng, density * 0.25)) shaker[i] = 1;
    }
    return shaker;
  }

  // ---------------------------------------------------------------------------
  // Bass generator — rolling off-beat ostinato that leaves space for the kick.
  // ---------------------------------------------------------------------------
  function makeBass(rng, scale, motif, groove, hardgroove) {
    const sub = zeros();
    const bassNotes = new Array(STEPS).fill(0);
    const root = scale[0];
    const fifth = scale[Math.min(3, scale.length - 1)];
    const rolling = hardgroove > 0.4;
    for (let i = 0; i < STEPS; i += 1) {
      const offbeat8 = i % 4 === 2;
      const syncop = i % 4 === 3;
      if (offbeat8) {
        sub[i] = 1;
        bassNotes[i] = chance(rng, 0.7) ? root : fifth;
      } else if (rolling && syncop && chance(rng, 0.25 + groove * 0.35)) {
        sub[i] = 1;
        bassNotes[i] = motif.degrees[i % motif.degrees.length] % 2 === 0 ? root : fifth;
      }
    }
    return { sub, bassNotes };
  }

  // ---------------------------------------------------------------------------
  // Melody / motif — Beethoven cell stretched across one bar, techno-minimal.
  // ---------------------------------------------------------------------------
  function makeMotif(rng, scale) {
    const span = Math.max(3, scale.length - 2);
    const cell = [
      0,
      chance(rng, 0.5) ? 0 : pick(rng, [1, 2]),
      pick(rng, [0, 2, 3]),
      chance(rng, 0.4) ? 0 : pick(rng, [2, 3, 4 % span]),
    ];
    const gates = [1, chance(rng, 0.55) ? 1 : 0, 1, chance(rng, 0.4) ? 1 : 0];
    return { degrees: cell, gates: gates, span: span, octave: 1 };
  }

  function developMotif(motif, rng, technique) {
    const next = {
      degrees: motif.degrees.slice(),
      gates: motif.gates.slice(),
      span: motif.span,
      octave: motif.octave,
    };
    if (technique === "invert") {
      next.degrees = invertDegrees(next.degrees, next.span);
    } else if (technique === "transpose") {
      const shift = pick(rng, [1, 2, 3]);
      next.degrees = next.degrees.map((d) => (d + shift) % next.span);
    } else if (technique === "displace") {
      next.degrees = rotate(next.degrees, pick(rng, [1, 2]));
      next.gates = rotate(next.gates, 1);
    } else if (technique === "fragment") {
      next.gates = [1, 0, next.gates[2], 0];
    } else if (technique === "octave") {
      next.octave = next.octave === 1 ? 2 : 1;
    } else {
      // Repeat with a single altered gate — Fred-style hook variation.
      const idx = Math.floor(rng() * 4);
      next.gates[idx] = next.gates[idx] ? 0 : 1;
    }
    return next;
  }

  function motifToAcid(motif, scale) {
    const acid = zeros();
    const notes = new Array(STEPS).fill(scale[0]);
    for (let i = 0; i < STEPS; i += 1) {
      const cell = i % 4;
      const gate = motif.gates[cell];
      // Last four steps: Beethoven-style variation of the same cell.
      const vary = i >= 12 && cell === 2 ? 1 : gate;
      acid[i] = vary;
      const degree = motif.degrees[cell];
      notes[i] = scale[degree % scale.length] * motif.octave;
    }
    return { acid, notes };
  }

  function emptyTracks() {
    const pattern = {};
    TRACK_IDS.forEach((id) => {
      pattern[id] = zeros();
    });
    return pattern;
  }

  // ---------------------------------------------------------------------------
  // Arrangement — DJ-friendly layering, tension / release, no full song dump.
  // ---------------------------------------------------------------------------
  function layersForPhase(phase, rng, hardgroove) {
    if (phase === "intro") {
      return {
        kick: true,
        closedHat: true,
        openHat: false,
        clap: false,
        perc: chance(rng, 0.25),
        shaker: chance(rng, 0.35),
        sub: false,
        acid: false,
      };
    }
    if (phase === "groove") {
      return {
        kick: true,
        closedHat: true,
        openHat: true,
        clap: true,
        perc: true,
        shaker: true,
        sub: true,
        acid: chance(rng, 0.35 + hardgroove * 0.2),
      };
    }
    if (phase === "peak") {
      return {
        kick: true,
        closedHat: true,
        openHat: true,
        clap: true,
        perc: true,
        shaker: true,
        sub: true,
        acid: true,
      };
    }
    if (phase === "break") {
      return {
        kick: false,
        closedHat: chance(rng, 0.6),
        openHat: true,
        clap: false,
        perc: true,
        shaker: true,
        sub: chance(rng, 0.4),
        acid: true,
      };
    }
    return {
      kick: true,
      closedHat: true,
      openHat: true,
      clap: true,
      perc: true,
      shaker: chance(rng, 0.8),
      sub: true,
      acid: true,
    };
  }

  function fxForPhase(phase, hardgroove, groove) {
    if (phase === "intro") {
      return { cutoff: 480, resonance: 8, drive: 0.18 + hardgroove * 0.1, reverb: 0.16, feedback: 0.22 };
    }
    if (phase === "peak") {
      return { cutoff: 1400 + hardgroove * 1800, resonance: 14, drive: 0.32 + hardgroove * 0.22, reverb: 0.18, feedback: 0.4 };
    }
    if (phase === "break") {
      return { cutoff: 2200, resonance: 10, drive: 0.14, reverb: 0.42, feedback: 0.5 };
    }
    return { cutoff: 900, resonance: 11 + groove * 4, drive: 0.26 + hardgroove * 0.12, reverb: 0.22, feedback: 0.32 };
  }

  function renderSession(session, controls) {
    const { rng } = session;
    const hardgroove = controls.hardgroove;
    const groove = controls.groove;
    const layers = layersForPhase(session.phase, rng, hardgroove);
    session.layers = layers;

    const kick = maskPattern(session.parts.kick, layers.kick);
    const hats = session.parts;
    const pattern = emptyTracks();
    pattern.kick = kick;
    pattern.closedHat = maskPattern(hats.closedHat, layers.closedHat);
    pattern.openHat = maskPattern(hats.openHat, layers.openHat);
    pattern.clap = maskPattern(hats.clap, layers.clap);
    pattern.perc = maskPattern(hats.perc, layers.perc);
    pattern.shaker = maskPattern(hats.shaker, layers.shaker);
    pattern.sub = maskPattern(hats.sub, layers.sub);
    pattern.acid = maskPattern(session.parts.acid, layers.acid);

    const fx = fxForPhase(session.phase, hardgroove, groove);
    const bpm = Math.round(134 + hardgroove * 12);
    const swing = 0.05 + groove * 0.16;

    return {
      pattern: pattern,
      notes: session.parts.notes.slice(),
      bassNotes: session.parts.bassNotes.slice(),
      bpm: Math.min(150, Math.max(130, bpm)),
      swing: swing,
      fx: fx,
      phase: session.phase,
      seed: session.seed,
      motif: session.motif.degrees.join("-"),
      nextInterval: session.nextInterval,
      bar: session.bar,
      scaleName: session.scaleName,
    };
  }

  function createParts(rng, scale, motif, controls) {
    const hats = makeHats(rng, controls.groove, controls.hardgroove);
    const bass = makeBass(rng, scale, motif, controls.groove, controls.hardgroove);
    const lead = motifToAcid(motif, scale);
    return {
      kick: makeKick(rng, controls.hardgroove),
      closedHat: hats.closedHat,
      openHat: hats.openHat,
      clap: makeClap(rng, controls.groove),
      perc: makePerc(rng, controls.hardgroove, controls.groove),
      shaker: makeShaker(rng, controls.groove, controls.hardgroove),
      sub: bass.sub,
      bassNotes: bass.bassNotes,
      acid: lead.acid,
      notes: lead.notes,
    };
  }

  function createSession(controls, seed) {
    const rng = mulberry32(seed);
    const scaleName = pick(rng, Object.keys(SCALES));
    const scale = SCALES[scaleName];
    const motif = makeMotif(rng, scale);
    const session = {
      seed: seed,
      rng: rng,
      scaleName: scaleName,
      scale: scale,
      motif: motif,
      phase: "intro",
      bar: 0,
      nextInterval: phraseLength(rng, controls.evolution),
      parts: null,
      layers: null,
      active: true,
    };
    session.parts = createParts(rng, scale, motif, controls);
    return session;
  }

  function nextPhase(phase) {
    const index = PHASES.indexOf(phase);
    return PHASES[(index + 1) % PHASES.length];
  }

  /**
   * Controlled mutation. High randomness → more phase jumps and motif transforms.
   * Low randomness → micro-groove edits (hats / perc) so the loop stays hypnotic.
   */
  function evolveSession(session, controls) {
    const rng = session.rng;
    const jump = chance(rng, 0.22 + controls.randomness * 0.45);
    if (jump) {
      session.phase = nextPhase(session.phase);
      const technique = pick(rng, ["invert", "transpose", "displace", "fragment", "octave", "hook"]);
      session.motif = developMotif(session.motif, rng, technique);
      session.lastMove = session.phase + "/" + technique;
      if (session.phase === "groove" || session.phase === "peak") {
        session.parts.perc = makePerc(rng, controls.hardgroove, controls.groove);
        session.parts.shaker = makeShaker(rng, controls.groove, controls.hardgroove);
      }
      const lead = motifToAcid(session.motif, session.scale);
      session.parts.acid = lead.acid;
      session.parts.notes = lead.notes;
    } else {
      session.lastMove = "micro";
      const hats = makeHats(rng, controls.groove, controls.hardgroove);
      if (chance(rng, 0.5)) session.parts.closedHat = hats.closedHat;
      if (chance(rng, 0.4)) session.parts.openHat = hats.openHat;
      if (chance(rng, 0.45 + controls.hardgroove * 0.2)) {
        session.parts.perc = makePerc(rng, controls.hardgroove, controls.groove);
      }
      if (chance(rng, 0.3)) {
        const bass = makeBass(rng, session.scale, session.motif, controls.groove, controls.hardgroove);
        session.parts.sub = bass.sub;
        session.parts.bassNotes = bass.bassNotes;
      }
      if (chance(rng, controls.randomness * 0.5)) {
        session.motif = developMotif(session.motif, rng, "hook");
        const lead = motifToAcid(session.motif, session.scale);
        session.parts.acid = lead.acid;
        session.parts.notes = lead.notes;
      }
    }
    session.nextInterval = phraseLength(rng, controls.evolution);
    return session;
  }

  function compose(controls) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const session = createSession(controls, seed);
    const snapshot = renderSession(session, controls);
    snapshot.lastMove = "seed";
    snapshot.session = session;
    return snapshot;
  }

  function evolve(session, controls) {
    evolveSession(session, controls);
    const snapshot = renderSession(session, controls);
    snapshot.lastMove = session.lastMove;
    snapshot.session = session;
    return snapshot;
  }

  root.Hardgroove = {
    STEPS: STEPS,
    PHASES: PHASES,
    TRACK_IDS: TRACK_IDS,
    compose: compose,
    evolve: evolve,
  };
})(window);
