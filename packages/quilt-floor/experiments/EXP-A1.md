# EXP-A1 — Adversarial substrates: degenerate inputs and float-zoom identity eating

**Lane A, round 3 · axes: ADVERSARY × SUBSTRATE × SCALE** (round 2 covered Julia-set OTAs, NTT/finite-field kernels, twin-beam interference, Δ0 tilt — none adversarial, none N-varying, none float-zooming)

## Hypothesis

The multigrid's identity model is exact integer lifts, but the substrate is IEEE-754. Three adversarial walls were proposed: (a) N≠5 breaks structural theorems, (b) γ→0 freezes then corrupts, (c) extreme spacing breaks the dedup key. The valuable outcome is any band where the pipeline is *silently wrong*.

## Method

Four probes against `src/multigrid.mjs` (all measurements run twice; runs bit-identical modulo timing):

1. **N-substrate**: N=2..8 at generic γ, reach 3 — edge-length uniformity vs the claimed 2/N, tile-angle inventory, concurrence count.
2. **Near-singular γ**: γ = ε·(1,1,1,1,1), ε ∈ [0, 0.1] over 12 orders of magnitude — vertex/face/edge counts, worst edge-length error, lift integrality.
3. **Zoom (spacing)**: s ∈ [1e-14, 1e12] — counts, edge error in lattice units, cross-spacing bitwise face-position diff.
4. **Zoom (reach)**: reach 3/10/100 — key magnitudes vs 2⁵³, build cost.

## Twice-run numbers (run 1 = run 2)

**N-substrate — NO WALL.** Edge length = 2/N to 1e-15 for every N=2..8; tile angles are exactly the multiples of 180/N° (N=4 gives the Ammann–Beenker {45°, 90°}; N=5 Penrose {36°, 72°}; N=6 {30°, 60°, 90°}). Zero concurrences at generic γ for all N. The construction is genuinely N-generic; the Σ n_k n_kᵀ = N/2·I identity holds universally. Honest negative — booked, not hidden.

**Near-singular γ — a three-layer corruption band (1e-9, 1e-6).**

| ε | vertices | triples | faces | edges | worst edge err | non-integer lifts |
|---|---|---|---|---|---|---|
| 0 | 361 | 61 | 900 | 1010 | 1.7e-15 | 0 |
| 1e-12 | 367 | 61 | 900 | 1010 | 1.5e-15 | 0 |
| 1e-9 | 458 | 22 | 908 | 1120 | **0.89** | 0 |
| 1e-8 | 490 | 0 | 920 | 1225 | **0.89** | 0 |
| 1e-7 | 490 | 0 | 935 | 1225 | **0.83** | 0 |
| 1e-6 | 490 | 0 | 1006 | 1225 | 1.3e-15 | 0 |

- **Frozen zone ε ≲ 5e-10**: output bit-identical to ε=0 — the pipeline cannot even *see* perturbations below the 1e-9 dedup-key quantum.
- **Corruption band ε ∈ [1e-9, 1e-7]**: counts wrong (908/920/935 faces vs 1006), worst-case dual edge length 0.83–0.89 instead of exactly 0.4, while `nonIntegerLifts = 0` throughout — the identity model stays exact-integer; the corruption is in *which* integers get assigned. Invisible to any integrality check.

**Zoom — collapse downward, *no wall* upward, and a half-wired parameter.**

| s | vertices | faces | edge err (lattice units) | cross-s position diff |
|---|---|---|---|---|
| 1e-12 | 1 | 0 | — | — |
| 1e-9 | 157 | 291 | 1.9e-15 | 0 |
| 1e-6 | 490 | 1011 | 1.9e-15 | 0 |
| 1 | 490 | 1011 | 1.9e-15 | — |
| 1e9 | 490 | 1011 | 1.9e-15 | **0** |
| 1e12 | 490 | 1011 | 1.9e-15 | **0** |

- **s → 0**: total collapse at s ≲ 1e-10 (all vertices merge into one fake concurrence; faces annihilate).
- **s → ∞**: counts perfect through s=1e12. The feared 2⁵³ key-snap wall **does not exist** — keys snap to even integers in lockstep with vertex separation, so dedup is unaffected.
- **The real finding**: faces matched by lift across spacings have **bitwise-identical positions** — `faces()` implements the strip-center formula *without* the spacing factor (`const { N, normals, gamma } = this;` — spacing never enters). The dual is spacing-blind: it always lives in lattice units (edge length 2/5) while `arrangementVertices`/`arrangementSegments` scale with `spacing`. At any s≠1 the object operates in **two unit systems simultaneously**; `dualTiles()` even mixes them (arrangement-unit `at` with lattice-unit corners). No pin covers this: the test file only ever uses the default s=1.

**Reach zoom**: vertices grow as ~4.04·reach² (404,010 at reach 100, 2.6 s build); generic γ keeps maxLines=2 at every reach — no spontaneous concurrences. Keys exceed 2⁵³ already at reach 10 (1e10) with zero observable damage, confirming the zoom finding that the key wall is void.

## Boundary segment

The multigrid is robust to N and to upward zoom, but has a **silent corruption band near singular γ and tiny spacing of (1e-9, 1e-6)**, owned by three absolute epsilon layers in the pipeline:

1. vertex dedup key quantum `1e-9` (`Math.round(x*1e9)`),
2. zero-length segment filter `t2-t1 < 1e-9`,
3. face-probe offset `sign*1e-7*spacing`.

Below ~1e-9 the world freezes (changes are invisible); between 1e-9 and 1e-6 the geometry is silently wrong; above 1e-6 it is exact. Separately, `spacing` is a **half-wired parameter** — honored by the arrangement, ignored by the dual — so at s≠1 the two halves disagree by the full scale factor.

## Why the wall is where it is

The exact-integer identity lives in lift space, but every lift is *derived* from float geometry through three fixed absolute thresholds. Absolute epsilons + scale-free inputs = influence bands at each threshold. The lift outputs remain integers in the band because `tieFloor` floors whatever it sees — the corruption is upstream, in which cell gets assigned. Upward zoom is safe because both signal (vertex separation) and key quantum scale together; the 2⁵³ snap is a uniform regrid, not a merge.

## Three next probes (maximally different)

1. **EXP-B1 (direction: inside-out)**: adversarial *outputs* — mine the corruption band for lift signatures (which families flip first) and try to detect the band from dual structure alone, with no access to ε.
2. **EXP-B2 (domain: algebra)**: work in exact rational γ (BigInt fractions) via a subclass and re-map the band — does the wall move to ε=0 exactly, or does tieFloor's float comparison keep a residual band?
3. **EXP-B3 (adversary × timebase)**: park γ at the band edge (ε=3e-8) and tick it (A2 machinery) — is the corruption static or does it migrate/anneal through the sweep?
