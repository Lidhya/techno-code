# TECHNO-CODE

Browser-based warehouse techno engine. All tones are synthesized with the Web Audio API — no samples, no audio libraries.

Open `index.html` in a modern browser. Press **Play** (or Space) to start the AudioContext. Press **COMPOSE HARDGROOVE** to seed a new evolving track.

| File | Role |
|---|---|
| `index.html` | Shell: transport, sequencer, composer panel, signal path |
| `style.css` | Warehouse / OLED theme |
| `app.js` | Sequencer, voices, master-bus overlay, composer wiring |
| `hardgroove.js` | Seeded Hardgroove generator (rhythm, bass, motif, arrangement, evolution) |

---

## App features

- **16-step sequencer** — one 4/4 bar of 16th notes. Tracks: kick, sub, closed hat, open hat, clap, perc, shaker, acid. Paint steps, mute rows, load presets, GENERATE a one-shot groove, or CLEAR.
- **Transport** — Play / Stop, BPM 120–150, master gain. Swing delays odd 16ths.
- **Signal path** — live cutoff, resonance, distortion, reverb, delay feedback, 1/8 or 1/16 delay sync.
- **Master bus** — frequency bars plus a neon-green dump of live `0`/`1` pattern bits. Grid edits and playhead motion show up immediately.
- **Hardgroove composer** — documented below. GENERATE / presets / CLEAR stop the composer so it does not overwrite a manual edit.

Timing uses a look-ahead scheduler (Chris Wilson pattern): notes are scheduled on the audio clock ~120 ms ahead, polled every 25 ms.

Swing for step index `i`:

```
base = 60 / bpm / 4          // one 16th
if i is even:  duration = base * (1 + swing)
if i is odd:   duration = base * (1 - swing)
```

---

## Composer overview

The composer does **not** store full songs. It builds:

1. A seeded RNG stream
2. One scale + one 4-note motif
3. Drum / perc / bass / acid parts for a single bar
4. An arrangement **phase** that masks those parts
5. Phrase-length evolution every 4, 8, 16, or 32 bars

Clicking **COMPOSE HARDGROOVE**:

1. Reads sliders (groove, randomness, hardgroove, evolution) as `0…1`
2. Calls `Hardgroove.compose(controls)`
3. Writes pattern, notes, bass notes, BPM, swing, and FX onto the engine
4. Starts playback if idle, otherwise resets the playhead to step 0

Each time the sequencer wraps from step 16 to 1, `app.js` counts a bar. When `barsUntilEvolve` hits 0 it calls `Hardgroove.evolve(session, controls)` and applies a new snapshot. The grid and master-bus overlay refresh with that snapshot.

### Controls

Sliders are stored as percentages in the UI and divided by 100 before use.

| Control | Default | Maps to | Effect |
|---|---|---|---|
| GROOVE | 62% | `groove` | Hat / shaker density, extra clap, bass syncopation, swing, some FX |
| RANDOMNESS | 40% | `randomness` | Chance of a phase jump vs a micro-edit; extra hook flips |
| HARDGROOVE | 70% | `hardgroove` | BPM, ghost kicks, 8th-note open hats, perc pulses, rolling bass, drive |
| EVOLUTION | 55% | `evolution` | Which phrase lengths are more likely (4 / 8 / 16 / 32 bars) |

HUD fields: **SEED** (hex), **PHASE**, **MOTIF** (scale degrees), **NEXT** (bars until the next change).

---

## Seed and RNG

```
seed = (Date.now() XOR floor(random * 2^32)) >>> 0
```

All musical decisions after that use **mulberry32** so one seed produces a repeatable stream (the seed itself still includes wall-clock time, so each click is a new piece).

```
t += 0x6D2B79F5
r = imul(t XOR (t >>> 15), 1 OR t)
r XOR= r + imul(r XOR (r >>> 7), 61 OR r)
output = ((r XOR (r >>> 14)) >>> 0) / 2^32     // in [0, 1)
```

Helpers:

- `chance(p)` → true if `rng() < p`
- `pick(list)` → `list[floor(rng() * length)]`

---

## Grid and time

- **STEPS = 16** — indices `0…15`. Downbeats are `0, 4, 8, 12` (beats 1–4).
- Off-beat 8ths are steps where `i % 4 === 2` (the “and” of each beat).
- Odd 16ths are `i % 2 === 1`.

---

## Scales (Hz)

One scale is picked at compose time. All acid and bass pitches come from it. Tuning is the A2 family (root 110 Hz).

| Name | Degrees (Hz) | Character |
|---|---|---|
| `pentMin` | 110, 130.81, 146.83, 164.81, 196, 220, 261.63 | A minor pentatonic — club-safe |
| `dorian` | 110, 123.47, 146.83, 164.81, 184.99, 220, 246.94 | A dorian |
| `phrygian` | 110, 116.54, 130.81, 146.83, 164.81, 196, 220 | A phrygian — darker |

Bass **root** = `scale[0]`. Bass **fifth-ish** = `scale[min(3, length - 1)]` (E on pentatonic/phrygian, D# on dorian).

---

## Tempo and swing

```
bpm   = clamp(round(134 + hardgroove * 12), 130, 150)
swing = 0.05 + groove * 0.16
```

| hardgroove | BPM |
|---|---|
| 0.00 | 134 |
| 0.50 | 140 |
| 0.70 (default) | 142 |
| 1.00 | 146 |

| groove | swing |
|---|---|
| 0.00 | 5% |
| 0.62 (default) | ~14.9% |
| 1.00 | 21% |

Hardgroove techno typically sits **138–145 BPM**; the formula lands in that band for mid-to-high Hardgroove values.

---

## Rhythm calculations

### Kick

Always 4-on-the-floor, then optional ghost notes:

```
pattern = 1 0 0 0  1 0 0 0  1 0 0 0  1 0 0 0
P(step 14) = 0.25 + hardgroove * 0.45     // pickup before bar 1
P(step  3) = 0.12 + hardgroove * 0.25     // skippy 16th
P(step 11) = hardgroove * 0.20
```

At default Hardgroove 0.70: P(14)≈0.57, P(3)≈0.30, P(11)≈0.14.

### Closed hat

```
P(odd 16th)   = 0.72 + groove * 0.22      // 0.72 … 0.94
else P(any)   = 0.04 + groove * 0.08      // ghost on even 16ths
```

### Open hat

If `hardgroove > 0.45` (8th-note ride, Hardgroove style):

```
steps 2, 6, 10, 14
P(hit) = 0.75 + groove * 0.20             // 0.75 … 0.95
```

Else (sparser warehouse):

```
step  7 = always
P(step 15) = 0.80
P(step  3) = groove * 0.50
```

### Clap

```
step  4 = always (beat 2)
P(step 12) = 0.82                         // beat 4
P(step 10) = 0.20 + groove * 0.25
P(step  6) = 0.12
```

### Perc (Euclidean congas)

Bresenham / Bjorklund: `pulses` hits spread across 16 steps, then rotated so they sit in the holes around the kick.

```
bucket += pulses
if bucket >= 16: place a hit, bucket -= 16
then rotate by k ∈ {1, 2, 3, 5}

pulses = hardgroove > 0.55 ? pick{5, 7, 6} : pick{3, 5, 5}

if groove < 0.70:
  clear hits on downbeats (i % 4 === 0)

P(OR with euclidean(16, 2, rotate 3)) = 0.40
```

### Shaker

```
density = 0.35 + groove * 0.45 + hardgroove * 0.15
P(odd 16th) = density
else P(hit) = density * 0.25
```

At defaults (groove 0.62, hardgroove 0.70): density ≈ 0.73.

---

## Bass calculations

Leaves the downbeat for the kick. Rolling 16ths only when Hardgroove is high.

```
root  = scale[0]
fifth = scale[min(3, length-1)]
rolling = hardgroove > 0.40

for each step i:
  if i % 4 === 2:                          // off-beat 8th
    always hit
    pitch = root with P=0.70, else fifth
  else if rolling and i % 4 === 3:
    P(hit) = 0.25 + groove * 0.35
    pitch = root if motif.degree[i % 4] is even, else fifth
```

Sidechain in `app.js` ducks the sub bus on every kick (not part of `hardgroove.js`):

```
attack to 0.12 in 18 ms
release to 1.0 in min(0.32, 0.85 * beatDuration) seconds
```

---

## Motif (Beethoven cell)

A 4-step cell is tiled across the 16-step bar (techno-minimal: one idea, repeated).

```
span = max(3, scale.length - 2)

degrees[0] = 0                             // tonic
degrees[1] = 0 with P=0.50, else pick{1, 2}
degrees[2] = pick{0, 2, 3}
degrees[3] = 0 with P=0.40, else pick{2, 3, 4 % span}

gates[0] = 1
gates[1] = 1 with P=0.55 else 0
gates[2] = 1
gates[3] = 1 with P=0.40 else 0
octave   = 1
```

Map to acid:

```
for i in 0..15:
  cell = i % 4
  gate = motif.gates[cell]
  if i >= 12 and cell === 2: gate = 1     // last beat: force the 3rd cell on
  noteHz = scale[degree % scale.length] * octave
```

HUD **MOTIF** is `degrees.join("-")`, e.g. `0-2-0-3`.

### Development techniques

Used on a **phase jump**. Inversion wraps around `span`:

```
invert:     d' = (span - d + span) % span
transpose:  d' = (d + shift) % span,  shift ∈ {1, 2, 3}
displace:   rotate degrees by 1 or 2; rotate gates by 1
fragment:   gates = [1, 0, gates[2], 0]
octave:     octave = 2 if it was 1, else 1
hook:       flip a single random gate (Fred again..-style hook edit)
```

---

## Arrangement phases

Cycle: **intro → groove → peak → break → rebuild → intro → …**

A phase only **masks** the stored parts (mute by writing zeros). Parts stay in memory so a rebuild can bring the kick back.

| Phase | Kick | CH | OH | Clap | Perc | Shaker | Sub | Acid |
|---|---|---|---|---|---|---|---|---|
| intro | on | on | off | off | P=0.25 | P=0.35 | off | off |
| groove | on | on | on | on | on | on | on | P=`0.35 + hardgroove*0.2` |
| peak | on | on | on | on | on | on | on | on |
| break | **off** | P=0.60 | on | off | on | on | P=0.40 | on |
| rebuild | on | on | on | on | on | P=0.80 | on | on |

Break = tension (kick out, motif still running). Rebuild = release (kick returns). That is the techno analogue of Beethoven tension/resolution and Fred again.. drop vs breakdown.

---

## FX per phase

Applied to the live SIGNAL PATH sliders when a snapshot lands.

**Intro**

```
cutoff=480  Q=8  drive=0.18+hardgroove*0.10  reverb=0.16  delayFB=0.22
```

**Peak**

```
cutoff=1400+hardgroove*1800  Q=14  drive=0.32+hardgroove*0.22  reverb=0.18  delayFB=0.40
```

**Break**

```
cutoff=2200  Q=10  drive=0.14  reverb=0.42  delayFB=0.50
```

**Groove / rebuild (default)**

```
cutoff=900  Q=11+groove*4  drive=0.26+hardgroove*0.12  reverb=0.22  delayFB=0.32
```

At default sliders, peak cutoff ≈ 2660 Hz and drive ≈ 47%.

---

## Phrase length (evolution interval)

Picked after compose and after every evolve:

```
if evolution < 0.34:  pool = [8, 16, 16, 32, 32]   // long DJ phrases
if evolution < 0.67:  pool = [4,  8,  8, 16, 16]   // default band
else:                 pool = [4,  4,  8,  8, 16]   // faster turnover
```

Default evolution 0.55 uses the middle pool. `app.js` decrements `barsUntilEvolve` on each completed bar (16 steps).

---

## Evolution branch

```
P(phase jump) = 0.22 + randomness * 0.45
```

| randomness | P(jump) |
|---|---|
| 0.00 | 0.22 |
| 0.40 (default) | 0.40 |
| 1.00 | 0.67 |

**Jump (true)**

1. Advance phase with `nextPhase`
2. Develop motif with a random technique from `{invert, transpose, displace, fragment, octave, hook}`
3. If new phase is groove or peak, rebuild perc + shaker
4. Rewrite acid from the new motif
5. `lastMove = phase + "/" + technique` (shown in the status line)

**Micro (false)** — hypnotic small change:

```
P(new closed hats) = 0.50
P(new open hats)   = 0.40
P(new perc)        = 0.45 + hardgroove * 0.20
P(new bass)        = 0.30
P(hook motif flip) = randomness * 0.50
lastMove = "micro"
```

Then a new phrase length is chosen from the evolution pool.

---

## Voices the composer uses

Defined in `app.js`, triggered from the 16-step grid:

| Track | Synthesis |
|---|---|
| Kick | Sine 150→45 Hz + square click; saturates into the kick bus |
| Sub | Low-passed saw at `bassNotes[step]` (or 55 / E2 fallback) |
| Hats / shaker | Looped noise, high-pass |
| Clap | Stacked band-pass noise + short triangle |
| Perc | Triangle tom/conga ~196 or 147 Hz, band-pass, pan L/R |
| Acid | Saw into shared resonant LPF + LFO; cutoff envelope per note |

Master chain: instrument buses → delay send / reverb send → master gain → compressor limiter → analyser → speakers.

---

## Research mapping (why these numbers exist)

- **Hardgroove** — 4/4 kick, tribal Euclidean perc off the downbeat, shakers on odd 16ths, 138–145 BPM, swing, long 8/16/32-bar DJ phrases.
- **Fred again..** — tiny hook (`gates` cell), repeat, one-gate “hook” edit, drums-out break then a bigger peak/rebuild.
- **Beethoven** — cell, repetition, invert / transpose / displace / fragment / octave, last-beat variation (`i >= 12`), tension (break) and resolution (rebuild).

Nothing is “random notes.” Pitch is scale degrees. Rhythm is probability on musical positions, Euclidean spacing, or a locked 4/4 skeleton.
