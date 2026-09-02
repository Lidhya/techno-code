/* =============================================================================
   CLASSICAL HARDGROOVE COMPOSER
   Seeded raga-techno generator. Same snapshot contract as hardgroove.js.

   Research mapping:
   - Ilaiyaraaja / Rahman: Mayamalavagowla, Charukesi, Todi (mela ragas)
   - Anirudh: 4/4 kick + off-beat rolling synth bass
   - Gopi Sundar: 16th hats under tavil / parai / solkattu accents
   - Rahman: acoustic intro → filter rise → full-spectrum drop; pads + vocal grain
   Counterpoint: bass moves against the raga lead, not in lockstep with the root.
   ============================================================================= */

(function (root) {
  "use strict";

  const STEPS = 16;
  const PHASES = ["intro", "rise", "drop", "break", "rebuild"];
  const TRACK_IDS = ["kick", "sub", "closedHat", "openHat", "clap", "perc", "shaker", "acid"];

  // Swaras as semitone offsets from Sa (C3). Harmonic minor is not used —
  // these are 15th, 26th, and 8th mela ragas.
  const RAGAS = {
    mayamalavagowla: {
      name: "Mayamalavagowla",
      offsets: [0, 1, 4, 5, 7, 8, 11],
      pakad: [0, 1, 2, 3, 4, 3, 2, 0],
    },
    charukesi: {
      name: "Charukesi",
      offsets: [0, 2, 4, 5, 7, 8, 10],
      pakad: [0, 1, 2, 4, 5, 4, 3, 0],
    },
    todi: {
      name: "Todi",
      offsets: [0, 1, 3, 5, 7, 8, 10],
      pakad: [0, 1, 2, 1, 0, 2, 4, 2],
    },
  };

  const SA_MIDI = 60; // C3

  function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function swaraHz(raga, degree, octave) {
    const span = raga.offsets.length;
    const wrapped = ((degree % span) + span) % span;
    const oct = Math.floor(degree / span) + (octave || 0);
    return midiToHz(SA_MIDI + raga.offsets[wrapped] + oct * 12);
  }

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

  function maskPattern(source, enabled) {
    return enabled ? source.slice() : zeros();
  }

  function cloneMotif(motif) {
    return {
      degrees: motif.degrees.slice(),
      gates: motif.gates.slice(),
      octave: motif.octave,
    };
  }

  /**
   * 40-bar film-score arc. High evolution compresses to 20 bars.
   * intro = acoustic, rise = filter, drop = classical techno.
   */
  function formPlan(evolution) {
    if (evolution >= 0.67) {
      return [
        { phase: "intro", bars: 4, lead: "flute" },
        { phase: "rise", bars: 4, lead: "hybrid" },
        { phase: "drop", bars: 8, lead: "synth" },
        { phase: "break", bars: 4, lead: "flute" },
        { phase: "rebuild", bars: 4, lead: "hybrid" },
      ];
    }
    return [
      { phase: "intro", bars: 8, lead: "flute" },
      { phase: "rise", bars: 8, lead: "hybrid" },
      { phase: "drop", bars: 16, lead: "synth" },
      { phase: "break", bars: 8, lead: "flute" },
      { phase: "rebuild", bars: 8, lead: "hybrid" },
    ];
  }

  function makeMotif(rng, raga) {
    const pakad = raga.pakad.slice();
    // 8-step Carnatic hook; gates keep space for gamaka, not a wall of 16ths.
    const degrees = pakad.map((d, i) => {
      if (i > 0 && chance(rng, 0.18)) return Math.max(0, d + pick(rng, [-1, 0, 1]));
      return d;
    });
    const gates = degrees.map((_, i) => (i % 2 === 0 || chance(rng, 0.55) ? 1 : 0));
    gates[0] = 1;
    return { degrees: degrees, gates: gates, octave: 1 };
  }

  function developMotif(motif, rng, technique) {
    const next = cloneMotif(motif);
    if (technique === "invert") {
      const peak = Math.max.apply(null, next.degrees);
      next.degrees = next.degrees.map((d) => peak - d);
    } else if (technique === "displace") {
      next.degrees = rotate(next.degrees, pick(rng, [1, 2, 3]));
      next.gates = rotate(next.gates, 1);
    } else if (technique === "fragment") {
      next.gates = next.gates.map((g, i) => (i % 2 === 0 ? g : 0));
    } else if (technique === "octave") {
      next.octave = next.octave === 1 ? 0 : 1;
    } else {
      const idx = 1 + Math.floor(rng() * (next.degrees.length - 1));
      next.degrees[idx] = Math.max(0, next.degrees[idx] + pick(rng, [-1, 1]));
      const g = Math.floor(rng() * next.gates.length);
      next.gates[g] = next.gates[g] ? 0 : 1;
    }
    return next;
  }

  function makeKick(rng, phase, hardgroove) {
    const kick = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    if (phase === "intro" || phase === "break") return zeros();
    if (phase === "rise") {
      kick[4] = 0;
      kick[12] = chance(rng, 0.5) ? 1 : 0;
      return kick;
    }
    if (chance(rng, 0.2 + hardgroove * 0.35)) kick[14] = 1;
    if (chance(rng, hardgroove * 0.2)) kick[3] = 1;
    return kick;
  }

  function makeHats(rng, groove, phase) {
    const closedHat = zeros();
    const openHat = zeros();
    for (let i = 0; i < STEPS; i += 1) {
      if (phase === "intro") {
        if (i % 4 === 2 && chance(rng, 0.4)) closedHat[i] = 1;
      } else if (i % 2 === 1) {
        closedHat[i] = chance(rng, 0.82 + groove * 0.15) ? 1 : 0;
      } else if (chance(rng, 0.08 + groove * 0.08)) {
        closedHat[i] = 1;
      }
    }
    if (phase === "intro" || phase === "break") {
      openHat[0] = 1;
      if (chance(rng, 0.6)) openHat[8] = 1;
      if (chance(rng, 0.35)) openHat[12] = 1;
    } else {
      openHat[6] = 1;
      openHat[14] = chance(rng, 0.75) ? 1 : 0;
    }
    return { closedHat, openHat };
  }

  /**
   * Parai (folk snare) on backbeats plus syncopated slaps — Gopi Sundar top-loop.
   */
  function makeParai(rng, groove, phase) {
    const clap = zeros();
    if (phase === "intro") return clap;
    clap[4] = 1;
    clap[12] = 1;
    if (chance(rng, 0.35 + groove * 0.3)) clap[6] = 1;
    if (chance(rng, 0.25 + groove * 0.2)) clap[10] = 1;
    if (chance(rng, 0.18)) clap[7] = 1;
    return clap;
  }

  /**
   * Tavil / solkattu layer: 3- or 5-pulse Euclidean against the 4/4 kick.
   */
  function makeTavil(rng, hardgroove, groove, phase) {
    if (phase === "intro") return euclidean(STEPS, 3, 2);
    const pulses = hardgroove > 0.55 ? pick(rng, [5, 7]) : pick(rng, [3, 5]);
    let perc = euclidean(STEPS, pulses, pick(rng, [1, 2, 3, 5]));
    perc = perc.map((bit, i) => (i % 4 === 0 && groove < 0.75 ? 0 : bit));
    return perc;
  }

  function makeShaker(rng, groove, phase) {
    const shaker = zeros();
    if (phase === "intro") return shaker;
    const density = 0.4 + groove * 0.4;
    for (let i = 0; i < STEPS; i += 1) {
      if (i % 2 === 1 && chance(rng, density)) shaker[i] = 1;
    }
    return shaker;
  }

  /**
   * Off-beat rolling bass (Anirudh) in contrary motion to the lead degrees.
   */
  function makeBass(rng, raga, motif, groove, phase) {
    const sub = zeros();
    const bassNotes = new Array(STEPS).fill(0);
    const peak = Math.max.apply(null, motif.degrees);
    for (let i = 0; i < STEPS; i += 1) {
      const offbeat = i % 4 === 2;
      const syncop = i % 4 === 3;
      if (phase === "intro" && !offbeat) continue;
      if (offbeat || (syncop && chance(rng, 0.28 + groove * 0.3))) {
        sub[i] = 1;
        const leadDeg = motif.degrees[i % motif.degrees.length];
        const contrary = Math.max(0, peak - leadDeg);
        bassNotes[i] = swaraHz(raga, contrary, -2);
      }
    }
    if (phase === "drop" || phase === "rebuild") {
      sub[0] = 1;
      bassNotes[0] = swaraHz(raga, 0, -2);
    }
    return { sub, bassNotes };
  }

  function motifToLead(motif, raga, sixteenth, phase) {
    const acid = zeros();
    const notes = new Array(STEPS).fill(swaraHz(raga, 0, 1));
    const chordNotes = new Array(STEPS).fill(null);
    const noteDecay = new Array(STEPS).fill(sixteenth * 2);
    const span = motif.degrees.length;

    for (let i = 0; i < STEPS; i += 1) {
      const cell = i % span;
      const sparse = phase === "intro" || phase === "break";
      const gate = sparse ? (i % 2 === 0 ? motif.gates[cell] : 0) : motif.gates[cell];
      acid[i] = gate;
      notes[i] = swaraHz(raga, motif.degrees[cell], motif.octave);
      noteDecay[i] = (sparse ? 4 : 2) * sixteenth;
    }

    const pad = [
      swaraHz(raga, 0, 0),
      swaraHz(raga, 2, 0),
      swaraHz(raga, 4, 0),
    ];
    chordNotes[0] = pad;
    if (phase !== "drop") chordNotes[8] = pad;
    return { acid, notes, chordNotes, noteDecay };
  }

  function emptyTracks() {
    const pattern = {};
    TRACK_IDS.forEach((id) => {
      pattern[id] = zeros();
    });
    return pattern;
  }

  function layersForPhase(phase, rng) {
    if (phase === "intro") {
      return {
        kick: false,
        closedHat: chance(rng, 0.4),
        openHat: true,
        clap: false,
        perc: true,
        shaker: false,
        sub: chance(rng, 0.35),
        acid: true,
      };
    }
    if (phase === "rise") {
      return {
        kick: true,
        closedHat: true,
        openHat: true,
        clap: chance(rng, 0.4),
        perc: true,
        shaker: true,
        sub: true,
        acid: true,
      };
    }
    if (phase === "break") {
      return {
        kick: false,
        closedHat: chance(rng, 0.5),
        openHat: true,
        clap: false,
        perc: true,
        shaker: false,
        sub: chance(rng, 0.3),
        acid: true,
      };
    }
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

  function fxForPhase(phase, hardgroove, groove) {
    if (phase === "intro") {
      return { cutoff: 900, resonance: 6, drive: 0.08, reverb: 0.42, feedback: 0.22 };
    }
    if (phase === "rise") {
      return {
        cutoff: 1400 + hardgroove * 1200,
        resonance: 11,
        drive: 0.18,
        reverb: 0.3,
        feedback: 0.4,
      };
    }
    if (phase === "break") {
      return { cutoff: 1800, resonance: 7, drive: 0.1, reverb: 0.48, feedback: 0.3 };
    }
    if (phase === "drop") {
      return {
        cutoff: 1200 + groove * 400,
        resonance: 12,
        drive: 0.3 + hardgroove * 0.18,
        reverb: 0.2,
        feedback: 0.32,
      };
    }
    return {
      cutoff: 1500,
      resonance: 13,
      drive: 0.28 + hardgroove * 0.15,
      reverb: 0.24,
      feedback: 0.36,
    };
  }

  function voicesForPhase(phase, lead) {
    return {
      clap: "parai",
      perc: "tavil",
      acid: lead,
      openHat: phase === "intro" || phase === "break" ? "vocal" : "hat",
      pad: true,
    };
  }

  function bpmFor(hardgroove) {
    return Math.min(130, Math.max(124, Math.round(127 + (hardgroove - 0.5) * 6)));
  }

  function createParts(rng, raga, motif, controls, phase, sixteenth) {
    const hats = makeHats(rng, controls.groove, phase);
    const bass = makeBass(rng, raga, motif, controls.groove, phase);
    const lead = motifToLead(motif, raga, sixteenth, phase);
    return {
      kick: makeKick(rng, phase, controls.hardgroove),
      closedHat: hats.closedHat,
      openHat: hats.openHat,
      clap: makeParai(rng, controls.groove, phase),
      perc: makeTavil(rng, controls.hardgroove, controls.groove, phase),
      shaker: makeShaker(rng, controls.groove, phase),
      sub: bass.sub,
      bassNotes: bass.bassNotes,
      acid: lead.acid,
      notes: lead.notes,
      chordNotes: lead.chordNotes,
      noteDecay: lead.noteDecay,
    };
  }

  function renderSession(session, controls) {
    const layers = layersForPhase(session.phase, session.rng);
    session.layers = layers;
    const pattern = emptyTracks();
    pattern.kick = maskPattern(session.parts.kick, layers.kick);
    pattern.closedHat = maskPattern(session.parts.closedHat, layers.closedHat);
    pattern.openHat = maskPattern(session.parts.openHat, layers.openHat);
    pattern.clap = maskPattern(session.parts.clap, layers.clap);
    pattern.perc = maskPattern(session.parts.perc, layers.perc);
    pattern.shaker = maskPattern(session.parts.shaker, layers.shaker);
    pattern.sub = maskPattern(session.parts.sub, layers.sub);
    pattern.acid = maskPattern(session.parts.acid, layers.acid);

    const bpm = bpmFor(controls.hardgroove);
    const sixteenth = 60 / bpm / 4;
    const fx = fxForPhase(session.phase, controls.hardgroove, controls.groove);
    fx.delayDivision = 8;
    fx.acidDecay = sixteenth * 2;

    return {
      engine: "classical",
      pattern: pattern,
      notes: session.parts.notes.slice(),
      bassNotes: session.parts.bassNotes.slice(),
      chordNotes: session.parts.chordNotes.map((chord) => (chord ? chord.slice() : null)),
      noteDecay: session.parts.noteDecay.slice(),
      bpm: bpm,
      swing: 0.03 + controls.groove * 0.1,
      fx: fx,
      phase: session.phase,
      harmony: session.raga.name,
      seed: session.seed,
      motif: session.raga.name + " " + session.motif.degrees.join("-"),
      nextInterval: session.nextInterval,
      bar: session.bar,
      voices: session.voices,
      scaleName: session.ragaKey,
    };
  }

  function applyFormStep(session, controls, step) {
    session.phase = step.phase;
    session.nextInterval = step.bars;
    session.voices = voicesForPhase(step.phase, step.lead);
    const technique = chance(session.rng, controls.randomness * 0.5)
      ? pick(session.rng, ["invert", "displace", "fragment", "octave", "hook"])
      : (step.phase === "drop" || step.phase === "rebuild" ? "hook" : "fragment");
    if (step.phase === "intro" && session.formIndex === 0) {
      session.motif = cloneMotif(session.homeMotif);
    } else {
      session.motif = developMotif(session.motif, session.rng, technique);
    }
    session.lastMove = session.phase + "/" + step.lead + "/" + technique;
    const sixteenth = 60 / bpmFor(controls.hardgroove) / 4;
    session.parts = createParts(session.rng, session.raga, session.motif, controls, session.phase, sixteenth);
  }

  function createSession(controls, seed) {
    const rng = mulberry32(seed);
    const ragaKey = pick(rng, Object.keys(RAGAS));
    const raga = RAGAS[ragaKey];
    const motif = makeMotif(rng, raga);
    const plan = formPlan(controls.evolution);
    const session = {
      engine: "classical",
      seed: seed,
      rng: rng,
      ragaKey: ragaKey,
      raga: raga,
      homeMotif: cloneMotif(motif),
      motif: motif,
      phase: plan[0].phase,
      formPlan: plan,
      formIndex: 0,
      bar: 0,
      nextInterval: plan[0].bars,
      voices: voicesForPhase(plan[0].phase, plan[0].lead),
      parts: null,
      layers: null,
      active: true,
      lastMove: "seed/" + raga.name,
    };
    const sixteenth = 60 / bpmFor(controls.hardgroove) / 4;
    session.parts = createParts(rng, raga, motif, controls, session.phase, sixteenth);
    return session;
  }

  function evolveSession(session, controls) {
    const plan = formPlan(controls.evolution);
    session.formPlan = plan;
    session.formIndex = (session.formIndex + 1) % plan.length;
    applyFormStep(session, controls, plan[session.formIndex]);
    return session;
  }

  function compose(controls) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const session = createSession(controls, seed);
    const snapshot = renderSession(session, controls);
    snapshot.lastMove = session.lastMove;
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

  root.Classical = {
    STEPS: STEPS,
    PHASES: PHASES,
    TRACK_IDS: TRACK_IDS,
    compose: compose,
    evolve: evolve,
  };
})(window);
