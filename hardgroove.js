/* =============================================================================
   HARDGROOVE COMPOSER
   Seeded, theory-constrained generator. No full songs — only motif, groove,
   Euclidean percussion, and a 32-bar Beethoven-techno form.

   Maps research onto a 16-step bar:
   - Hardgroove: 4-on-the-floor kick, tribal perc, rolling hats
   - Beethoven → techno: 3–4 note cell, SSSL rhythm, V→I / dim7 tension,
     subito cut-into-drop, 32-bar exposition / development / recap
   ============================================================================= */

(function (root) {
  "use strict";

  const STEPS = 16;
  const PHASES = ["exposition", "development", "cadence", "recap"];

  // Harmonic minor. Tension chords need the raised 7th (V and vii°7).
  // Melody sits near C3 / D3; bass uses the octave below.
  const SCALES = {
    cMin: {
      tones: [130.81, 146.83, 155.56, 174.61, 196.0, 207.65, 246.94],
      bass: 65.41,
    },
    dMin: {
      tones: [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 277.18],
      bass: 73.42,
    },
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

  function cloneMotif(motif) {
    return {
      degrees: motif.degrees.slice(),
      gates: motif.gates.slice(),
      span: motif.span,
      octave: motif.octave,
    };
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

  /**
   * 32-bar window at 132 BPM ≈ 58s (32 × 4 × 60/132).
   * High evolution compresses the same arc into 16 bars.
   */
  function formPlan(evolution) {
    if (evolution >= 0.67) {
      return [
        { phase: "exposition", bars: 4, harmony: "i", technique: "hook" },
        { phase: "development", bars: 4, harmony: "iv", technique: "invert" },
        { phase: "development", bars: 3, harmony: "dim", technique: "transpose" },
        { phase: "cadence", bars: 1, harmony: "V", technique: "fragment" },
        { phase: "recap", bars: 4, harmony: "i", technique: "home" },
      ];
    }
    return [
      { phase: "exposition", bars: 8, harmony: "i", technique: "hook" },
      { phase: "development", bars: 8, harmony: "iv", technique: "invert" },
      { phase: "development", bars: 7, harmony: "VofV", technique: "transpose" },
      { phase: "cadence", bars: 1, harmony: "V", technique: "fragment" },
      { phase: "recap", bars: 8, harmony: "i", technique: "home" },
    ];
  }

  function toneAt(scale, degree) {
    const span = scale.tones.length;
    const wrapped = ((degree % span) + span) % span;
    const oct = Math.floor(degree / span);
    return scale.tones[wrapped] * Math.pow(2, oct);
  }

  function bassRoot(scale, harmony) {
    if (harmony === "iv") return toneAt(scale, 3) / 2;
    if (harmony === "V") return toneAt(scale, 4) / 2;
    if (harmony === "VofV") return toneAt(scale, 1) / 2;
    if (harmony === "dim") return toneAt(scale, 6) / 2;
    return scale.bass;
  }

  function dim7Tones(scale) {
    return [toneAt(scale, 6), toneAt(scale, 1), toneAt(scale, 3), toneAt(scale, 5)];
  }

  function minorTriad(scale, rootDegree) {
    return [toneAt(scale, rootDegree), toneAt(scale, rootDegree + 2), toneAt(scale, rootDegree + 4)];
  }

  // ---------------------------------------------------------------------------
  // Rhythm generator
  // ---------------------------------------------------------------------------
  function makeKick(rng, hardgroove, phase) {
    const kick = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    // Fate pickup: short-short-short into the next downbeat (steps 13–15 → 0).
    const fate = phase === "recap" || phase === "exposition";
    if (fate && chance(rng, 0.35 + hardgroove * 0.5)) {
      kick[13] = 1;
      kick[14] = 1;
      kick[15] = 1;
    } else {
      if (chance(rng, 0.2 + hardgroove * 0.35)) kick[14] = 1;
      if (chance(rng, 0.1 + hardgroove * 0.2)) kick[3] = 1;
      if (chance(rng, hardgroove * 0.18)) kick[11] = 1;
    }
    if (phase === "development" || phase === "cadence") {
      kick[8] = chance(rng, 0.35) ? 1 : 0;
    }
    return kick;
  }

  function makeHats(rng, groove, hardgroove) {
    const closedHat = zeros();
    const openHat = zeros();
    const offbeat = 0.72 + groove * 0.22;
    for (let i = 0; i < STEPS; i += 1) {
      if (i % 2 === 1 && chance(rng, offbeat)) closedHat[i] = 1;
      else if (chance(rng, 0.05 + groove * 0.1)) closedHat[i] = 1;
    }
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
    if (groove < 0.7) {
      perc = perc.map((bit, i) => (i % 4 === 0 ? 0 : bit));
    }
    if (chance(rng, 0.4)) perc = orPatterns(perc, euclidean(STEPS, 2, 3));
    // Fate cell as a perc trigger: three 16ths before the barline.
    if (chance(rng, 0.45 + hardgroove * 0.25)) {
      perc[13] = 1;
      perc[14] = 1;
      perc[15] = 1;
    }
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
  // Bass — functional roots. Phrase downbeats resolve to tonic in recap.
  // ---------------------------------------------------------------------------
  function makeBass(rng, scale, motif, groove, hardgroove, harmony, phase) {
    const sub = zeros();
    const bassNotes = new Array(STEPS).fill(0);
    const tonic = scale.bass;
    const color = bassRoot(scale, harmony);
    const fifth = toneAt(scale, 4) / 2;
    const rolling = hardgroove > 0.4;
    for (let i = 0; i < STEPS; i += 1) {
      const offbeat8 = i % 4 === 2;
      const syncop = i % 4 === 3;
      if (i === 0 && (phase === "recap" || phase === "exposition")) {
        sub[i] = 1;
        bassNotes[i] = tonic;
        continue;
      }
      if (offbeat8) {
        sub[i] = 1;
        bassNotes[i] = chance(rng, 0.55) ? color : (chance(rng, 0.5) ? tonic : fifth);
      } else if (rolling && syncop && chance(rng, 0.25 + groove * 0.35)) {
        sub[i] = 1;
        const evenCell = motif.degrees[i % motif.degrees.length] % 2 === 0;
        bassNotes[i] = evenCell ? color : fifth;
      }
    }
    return { sub, bassNotes };
  }

  // ---------------------------------------------------------------------------
  // Melody / motif — 3–4 note cell, Fate SSSL gates, duration/pitch variation.
  // ---------------------------------------------------------------------------
  function makeMotif(rng, scale) {
    const span = scale.tones.length;
    const third = chance(rng, 0.28);
    const cell = third
      ? [0, pick(rng, [1, 2]), pick(rng, [0, 2, 3]), 0]
      : [
        0,
        chance(rng, 0.45) ? 0 : pick(rng, [1, 2]),
        pick(rng, [0, 2, 3]),
        chance(rng, 0.35) ? 0 : pick(rng, [2, 3, 4]),
      ];
    // Short-short-short-long: three 16ths, rest (long lands on the next downbeat).
    const gates = [1, 1, 1, third ? 0 : chance(rng, 0.25) ? 1 : 0];
    return { degrees: cell, gates: gates, span: span, octave: 1 };
  }

  function developMotif(motif, rng, technique) {
    const next = cloneMotif(motif);
    if (technique === "home") {
      return next;
    }
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
      // Duration tweak, not a new melody: flip one SSSL gate.
      const idx = Math.floor(rng() * 4);
      next.gates[idx] = next.gates[idx] ? 0 : 1;
      if (chance(rng, 0.35)) {
        const pitchIdx = 1 + Math.floor(rng() * 3);
        next.degrees[pitchIdx] = (next.degrees[pitchIdx] + pick(rng, [0, 1, -1 + next.span])) % next.span;
      }
    }
    return next;
  }

  function motifToAcid(motif, scale, harmony, phase, sixteenth) {
    const acid = zeros();
    const notes = new Array(STEPS).fill(scale.tones[0]);
    const chordNotes = new Array(STEPS).fill(null);
    const noteDecay = new Array(STEPS).fill(sixteenth);
    const isolate = phase === "development" || phase === "cadence";
    const tension = harmony === "V" || harmony === "VofV" || harmony === "dim";
    const dim = dim7Tones(scale);
    const triad = minorTriad(scale, harmony === "iv" ? 3 : 0);

    for (let i = 0; i < STEPS; i += 1) {
      const cell = i % 4;
      let gate = motif.gates[cell];
      if (isolate && cell !== 0 && cell !== 2) gate = 0;
      if (i >= 12 && cell === 2 && !isolate) gate = motif.gates[2] || 1;
      acid[i] = gate;
      const degree = motif.degrees[cell];
      notes[i] = toneAt(scale, degree) * motif.octave;
      noteDecay[i] = cell === 0 ? sixteenth * 2 : sixteenth;

      if (tension && cell === 3) {
        acid[i] = 1;
        notes[i] = dim[0];
        chordNotes[i] = dim.slice(0, 3);
        noteDecay[i] = sixteenth;
      }
    }

    if (phase === "recap") {
      chordNotes[0] = triad;
      noteDecay[0] = sixteenth * 2;
    }

    return { acid, notes, chordNotes, noteDecay };
  }

  function emptyTracks() {
    const pattern = {};
    TRACK_IDS.forEach((id) => {
      pattern[id] = zeros();
    });
    return pattern;
  }

  function muteLastSixteenth(pattern) {
    TRACK_IDS.forEach((id) => {
      pattern[id][15] = 0;
    });
  }

  // ---------------------------------------------------------------------------
  // Arrangement — 32-bar arc, development isolates the cell, recap is the drop.
  // ---------------------------------------------------------------------------
  function layersForPhase(phase, rng, hardgroove) {
    if (phase === "exposition") {
      return {
        kick: true,
        closedHat: true,
        openHat: chance(rng, 0.45),
        clap: chance(rng, 0.35),
        perc: chance(rng, 0.4),
        shaker: chance(rng, 0.5),
        sub: true,
        acid: true,
      };
    }
    if (phase === "development") {
      return {
        kick: false,
        closedHat: chance(rng, 0.55),
        openHat: true,
        clap: false,
        perc: true,
        shaker: true,
        sub: chance(rng, 0.45),
        acid: true,
      };
    }
    if (phase === "cadence") {
      return {
        kick: false,
        closedHat: false,
        openHat: chance(rng, 0.35),
        clap: false,
        perc: chance(rng, 0.3),
        shaker: false,
        sub: false,
        acid: true,
      };
    }
    return {
      kick: true,
      closedHat: true,
      openHat: true,
      clap: true,
      perc: true,
      shaker: chance(rng, 0.85 + hardgroove * 0.1),
      sub: true,
      acid: true,
    };
  }

  function fxForPhase(phase, hardgroove, groove) {
    if (phase === "exposition") {
      return { cutoff: 720, resonance: 9, drive: 0.2 + hardgroove * 0.1, reverb: 0.18, feedback: 0.24 };
    }
    if (phase === "development") {
      return {
        cutoff: 1600 + hardgroove * 900,
        resonance: 13,
        drive: 0.16,
        reverb: 0.34,
        feedback: 0.48,
      };
    }
    if (phase === "cadence") {
      return { cutoff: 2400, resonance: 8, drive: 0.1, reverb: 0.46, feedback: 0.55 };
    }
    return {
      cutoff: 1100 + groove * 200,
      resonance: 12 + groove * 3,
      drive: 0.34 + hardgroove * 0.2,
      reverb: 0.16,
      feedback: 0.28,
    };
  }

  function gridForBpm(bpm) {
    const beat = 60 / bpm;
    const sixteenth = beat / 4;
    return { beat: beat, sixteenth: sixteenth, phrase32: 32 * 4 * beat };
  }

  function renderSession(session, controls) {
    const { rng } = session;
    const hardgroove = controls.hardgroove;
    const groove = controls.groove;
    const layers = layersForPhase(session.phase, rng, hardgroove);
    session.layers = layers;

    const hats = session.parts;
    const pattern = emptyTracks();
    pattern.kick = maskPattern(session.parts.kick, layers.kick);
    pattern.closedHat = maskPattern(hats.closedHat, layers.closedHat);
    pattern.openHat = maskPattern(hats.openHat, layers.openHat);
    pattern.clap = maskPattern(hats.clap, layers.clap);
    pattern.perc = maskPattern(hats.perc, layers.perc);
    pattern.shaker = maskPattern(hats.shaker, layers.shaker);
    pattern.sub = maskPattern(hats.sub, layers.sub);
    pattern.acid = maskPattern(session.parts.acid, layers.acid);

    if (session.phase === "cadence") {
      muteLastSixteenth(pattern);
    }

    const bpm = Math.min(138, Math.max(128, Math.round(132 + (hardgroove - 0.7) * 6)));
    const grid = gridForBpm(bpm);
    const fx = fxForPhase(session.phase, hardgroove, groove);
    fx.delayDivision = 16;
    fx.acidDecay = grid.sixteenth;
    const swing = 0.04 + groove * 0.14;

    return {
      engine: "hardgroove",
      pattern: pattern,
      notes: session.parts.notes.slice(),
      bassNotes: session.parts.bassNotes.slice(),
      chordNotes: session.parts.chordNotes.map((chord) => (chord ? chord.slice() : null)),
      noteDecay: session.parts.noteDecay.slice(),
      bpm: bpm,
      swing: swing,
      fx: fx,
      grid: grid,
      phase: session.phase,
      harmony: session.harmony,
      seed: session.seed,
      motif: session.motif.degrees.join("-"),
      nextInterval: session.nextInterval,
      bar: session.bar,
      scaleName: session.scaleName,
    };
  }

  function createParts(rng, scale, motif, controls, harmony, phase, sixteenth) {
    const hats = makeHats(rng, controls.groove, controls.hardgroove);
    const bass = makeBass(rng, scale, motif, controls.groove, controls.hardgroove, harmony, phase);
    const lead = motifToAcid(motif, scale, harmony, phase, sixteenth);
    return {
      kick: makeKick(rng, controls.hardgroove, phase),
      closedHat: hats.closedHat,
      openHat: hats.openHat,
      clap: makeClap(rng, controls.groove),
      perc: makePerc(rng, controls.hardgroove, controls.groove),
      shaker: makeShaker(rng, controls.groove, controls.hardgroove),
      sub: bass.sub,
      bassNotes: bass.bassNotes,
      acid: lead.acid,
      notes: lead.notes,
      chordNotes: lead.chordNotes,
      noteDecay: lead.noteDecay,
    };
  }

  function applyFormStep(session, controls, step) {
    session.phase = step.phase;
    session.harmony = step.harmony;
    session.nextInterval = step.bars;
    const preferred = step.technique;
    const technique = preferred === "home"
      ? "home"
      : (chance(session.rng, controls.randomness * 0.55)
        ? pick(session.rng, ["invert", "transpose", "displace", "fragment", "octave", "hook"])
        : preferred);
    if (technique === "home") {
      session.motif = cloneMotif(session.homeMotif);
    } else {
      session.motif = developMotif(technique === "hook" ? session.motif : (session.phase === "exposition" ? session.homeMotif : session.motif), session.rng, technique);
    }
    session.lastMove = session.phase + "/" + technique + "/" + session.harmony;
    const bpm = Math.min(138, Math.max(128, Math.round(132 + (controls.hardgroove - 0.7) * 6)));
    const sixteenth = 60 / bpm / 4;
    session.parts = createParts(session.rng, session.scale, session.motif, controls, session.harmony, session.phase, sixteenth);
  }

  function createSession(controls, seed) {
    const rng = mulberry32(seed);
    const scaleName = pick(rng, Object.keys(SCALES));
    const scale = SCALES[scaleName];
    const motif = makeMotif(rng, scale);
    const plan = formPlan(controls.evolution);
    const session = {
      engine: "hardgroove",
      seed: seed,
      rng: rng,
      scaleName: scaleName,
      scale: scale,
      homeMotif: cloneMotif(motif),
      motif: motif,
      phase: plan[0].phase,
      harmony: plan[0].harmony,
      formPlan: plan,
      formIndex: 0,
      bar: 0,
      nextInterval: plan[0].bars,
      parts: null,
      layers: null,
      active: true,
      lastMove: "seed",
    };
    const bpm = Math.min(138, Math.max(128, Math.round(132 + (controls.hardgroove - 0.7) * 6)));
    session.parts = createParts(rng, scale, motif, controls, session.harmony, session.phase, 60 / bpm / 4);
    return session;
  }

  /**
   * Advance the 32-bar form. Motif stays the same cell: invert / transpose /
   * fragment / duration — never a new melody.
   */
  function evolveSession(session, controls) {
    const plan = formPlan(controls.evolution);
    session.formPlan = plan;
    session.formIndex = (session.formIndex + 1) % plan.length;
    applyFormStep(session, controls, plan[session.formIndex]);
    if (session.phase === "exposition" && session.formIndex === 0) {
      if (chance(session.rng, 0.4 + controls.randomness * 0.3)) {
        session.homeMotif = developMotif(session.homeMotif, session.rng, "hook");
        session.motif = cloneMotif(session.homeMotif);
        const bpm = Math.min(138, Math.max(128, Math.round(132 + (controls.hardgroove - 0.7) * 6)));
        session.parts = createParts(session.rng, session.scale, session.motif, controls, session.harmony, session.phase, 60 / bpm / 4);
        session.lastMove = "exposition/cycle-hook/i";
      }
    }
    return session;
  }

  function compose(controls) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const session = createSession(controls, seed);
    const snapshot = renderSession(session, controls);
    snapshot.lastMove = "seed/" + session.harmony;
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
