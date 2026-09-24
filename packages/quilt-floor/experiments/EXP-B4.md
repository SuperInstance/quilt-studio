# EXP-B4 — The Corruption Aquarium: the band as a living exhibit

**Scientist lane, round 4 · axes: TIMEBASE (residency vs static sweep) × PRESENTATION (live monitor vs report) × DIRECTION (live inside the wall vs probe it from outside)** · parents: EXP-A1 (band map), EXP-B3 (migration under ticking), EXP-B1 (dual-only detection)

## Hypothesis

A1 mapped the silent corruption band from outside: sweep ε, tabulate, report. The Aquarium tests what changes when the floor *lives* there: park a Multigrid at the resonant all-equal shift, drift ε through (1e-9,1e-6), and render two channels live — IDENTITY (lift integrality) and GEOMETRY (dual edge-length error vs the exact, γ-independent 2/5). If the invisibility holds under residency, the wall becomes experienceable, not just reportable. If a detector can call the verdict from dual structure alone (no ε), B1 closes.

## Method

- `src/aquarium.mjs` — the monitor: `aquariumVitals` (per-tick two-channel sample + position digest), `detectFromDual` (faces/edges only — no ε, no γ), `runResidency` (log-ramp drift, rebuild per tick, A2 lineage: geometry is the arbiter), `renderEkg` (ASCII two-channel trace).
- `experiments/exp-b4-aquarium.mjs` — the exhibit: 45-step residency 1e-10→1e-5 rendered live; the detector handed two *stranger* duals with zero provenance; the freeze refinement; twice-run determinism (A1 meta-rule).
- `tests/aquarium.test.mjs` — 6 pins, FAIL-first.

## Numbers (twice-run; runs identical)

**The EKG.** IDENTITY flatlines `ok` on all 45 ticks — every lift an exact integer even mid-melt. GEOMETRY: frozen ≤2.8e-10 (err ~1.8e-15), onset at **3.7e-10** (err 0.65 — *below* the 1e-9 dedup quantum), plateau 0.894 from 6.2e-10 through ~9e-8, annealing 0.83→0.65→0.36, **HEALED at 7.3e-7** (err ~1.9e-15). Nine distinct face-count plateaus migrate (900 → 908 → 920 → 924 → 933 → 935 → 980 → 985 → 1006). Corruption is not static rot: it is a **topology phase transition** between two exact regimes — frozen 900/1010 at ε=0, refrozen 1006/1225 above the band — and the pipeline's absolute epsilons own the melt between them.

**The detector (B1 closed).** `detectFromDual({faces, edges})` — edge-length spread (max−min): healthy ≤ 3.9e-15, corrupt ≥ 0.3608, threshold 1e-6 (ten orders of measured margin). Stranger duals, no provenance: healthy verdict at spread 3.4e-15, melt verdict at spread 0.89. The band is detectable from the dual alone — but only from *geometry*, never from identity.

**The freeze refinement.** A1 claimed the frozen zone is "bit-identical to ε=0". Refined: the COMBINATORICS freeze (900/1010 at ε=1e-11, identical to ε=0) while POSITIONS still move (digests differ — positions are γ-views, not identity; frames.mjs honest law). Both halves are pinned in the test so the refinement is itself a boundary segment.

**The fuzzy edge.** Onset at ~3.7e-10 is below the 1e-9 key quantum: `Math.round(x·1e9)` splits when the fractional part crosses 0.5, so the wall is fuzzy at half-quantum. A1's "frozen below 5e-10" was the same fact seen from outside; the residency pins the onset between 2.8e-10 (frozen) and 3.7e-10 (melting).

## Boundary segment

**Verification channels see their own channel, not the world.** The identity channel (integrality) verifies lift space; the corruption lives in which lift gets assigned — upstream, in float geometry. Exactness of identity is decoupled from correctness of geometry, demonstrably, for 29 consecutive ticks, with a detector that can only work on the geometry channel. This is the same silhouette as tonight's other wall: the ocean cache returns a HIT (0.9520) on injection wrappers clustered with their targets — the embedding channel verifies phrase-similarity, not intent. Two substrates, one shape: **a verifier verifies its input channel; an adversary who speaks that channel fluently walks through.**

## Why the wall is where it is

Lifts are DERIVED from float geometry through three fixed absolute thresholds (dedup quantum 1e-9, zero-length filter 1e-9, probe offset 1e-7·s). Absolute epsilons + scale-free inputs = influence bands at each threshold. `tieFloor` floors whatever it sees, so lift space stays internally exact through the whole band — the lie is consistent. The phase-transition shape comes from the resonant all-equal shift: ε=0 sits on a measure-zero concurrence lattice (900 faces); any visible ε must re-resolve the combinatorics, and while the re-resolution is epsilon-dominated the counts pass through quantized intermediate plateaus, each with wrong geometry, until the true concurrences separate cleanly (1006 faces, exact).

## Three next probes (maximally different)

1. **EXP-C1 (domain: therapy)**: can the melt be *steered* — apply a per-tick corrective nudge (γ dither at the probe offset's scale) and see whether the anneal sharpens or the plateau count grows? The aquarium as clinic, not just ward.
2. **EXP-C2 (adversary: targeted)**: the residency used the resonant direction; a generic-γ floor driven by an adversary who knows the three thresholds (ε placed at 0.5·quantum, hopping) — is fuzzy-edge hopping a real attack surface, and does the spread detector track it?
3. **EXP-C3 (substrate: receipt)**: book the EKG itself as witness rows (registry envelope: vitals per tick, detector verdicts, plateau transitions) — the exhibit's receipts become the fleet's first *self-scoring boundary segment*, ready for the Self-Witnessing Demo to consume.
