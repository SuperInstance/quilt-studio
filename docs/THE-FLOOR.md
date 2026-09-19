# THE FLOOR — distant projects, connected on the kernel

> Essays made executable. Every claim below is pinned by a test in
> `packages/quilt-floor/tests/` — run over **both** kernels
> (`QuiltKernel` reference JS + `WasmQuiltKernel` real WASM), because
> the polyformalism thesis (ai-writings #60: the cell survives translation)
> is only a thesis until the same pattern passes unchanged on two substrates.

## The five dots, and the lines between them

```
 ai-writings #51 (Penrose floor)      ai-writings #88 (Fibonacci clock)
        │                                       │
        ▼                                       ▼
   @quilt/floor: FibFloor ── same kernel ── FibClock ── A2A t-minus braid
        │                    clock, one tick              (accumulating vs
        │                    = one generation             countdown — two
        ▼                                                  readings of one
   Twist commensuration comb ◀── golden.mjs:              clock)
   (computed convergents)       convergentGaps()
        ▲
        │
 ai-fractal essays (shoreline,  ◀── Phyllomandel: one address
 meta-fractal) — self-similarity  space (phyllotaxis) for floor
 is the floor's deflation and     tiles and Mandelbrot orbiters
 the field's escape, one law      — fib meets mandelbrot HERE
        │
        ▼
   quilt RFC 0001 room-as-cell ── room.mjs: the first tenant
```

### 1. The Penrose floor (essay #51) → `FibFloor`

The essay's floor is the line: intervals, long (A, length 1) and short
(B, length 1/φ), ratio φ — the number that refuses to settle. Deflation
subdivides every tile by exactly φ, and the layout at generation g is the
Fibonacci word σ^g(A), σ: A→AB, B→A.

Executable as:

```js
const floor = new FibFloor(kernel);
floor.deflate();           // gen 1: 'AB'
floor.deflate();           // gen 2: 'ABA'
floor.layout();            // → 'ABAABABA…' — the word, exact
floor.intervals();         // [{kind:'A',x0:0,len:1/φ}, {kind:'B',…}, …]
```

Pinned by tests, both kernels:
- layout(g) === σ^g(A) for g = 0…8
- the floor is **perfectly tiled** at every generation — contiguous,
  spanning exactly the unit seed; |A|/|B| = φ to 1e-9
- forbidden patterns BB and AAA never occur (the matching rules of the line)
- substitution counts follow [[1,1],[1,0]]; the ratio zigzags into φ
  with the −1/φ eigenvalue's alternating decay

**Why 1D and not kite/dart 2D:** exactness is the product. The 1D floor
keeps every claim exactly testable; a from-memory 2D Robinson deflation
risks subtly wrong geometry. The 2D multigrid/cut-and-project floor is
roadmapped below — it will be built the same way: claims first, tests
pinning every one.

**Sedimentary time.** Generations never delete. Parents stay bound at
their generation; children take hierarchical names (`floor.0`'s children
are `floor.0.0`, `floor.0.1`). Live tiles are those whose `gen` equals
`floor.gen` — the cell graph *is* the lineage. The essay says "the floor
does not forget because the floor does not store. The floor IS." On the
kernel this reads literally: there is no side table of generations, only
cells.

**Time travel.** Reflation is explicit rebind, NOT `kernel.undo()` — a
hard-won distinction the round-4 playtester earned us. The undo-stack
version rewound whatever history it found: an interleaved FibClock lost
ticks yet kept its `ts`, silently inconsistent, and its 1e6-undo guard
aborted deep refolds without a word. Now `reflate(g)` recomputes the
target generation with the pure `FibFloor.plan(g)` (same ops, same
order, bit-identical) — unbinding the live hierarchical names the
target doesn't use and re-stamping those it does. Cost is honestly
O(tiles rebalanced); foreign tenants are untouched; kernel history only
grows. Undo is one step; reflate is geology. Re-deflating from a
refolded floor overwrites sediment with identical values — the regrow
test compares full JSON. History IS the future.

**The golden-direction walk** (the essay's recall) composes phyllotaxis
addresses along the floor — one address space shared with the field
(next dot).

### 2. Mandelbrot meets Fibonacci → `Phyllomandel`

The fractal essays' claim: self-similarity is one law wearing two faces —
the floor's deflation (structure doubling into itself) and the Mandelbrot
set's escape boundary (detail without end). `Phyllomandel` puts both in
one address space: c-parameter points seeded on the SAME phyllotaxis
projection as the floor tiles (GOLDEN_ANGLE ≈ 137.5077° — the sunflower
arrangement, one point per address).

- `field.{i}` cells hold `{c, z, iter, escaped}`; the orbit law
  z → z² + c runs as a kernel **effect** named `'step'`
- one `kernel.tick(1)` advances the WHOLE field coherently — field time
  is kernel time, exactly like floor time and clock time
- escape pinned against an **independent naive reference** in-test
  (test hygiene: never share the implementation under test), plus the
  classics: c=0 fixed point, c=−1 period-2, neither ever escapes
- `terrace()` reads the field's accumulation in Zeckendorf — how the
  evening nests

The meet: floor tiles and orbiters share `addressOf(i)`. Walk the floor
west-to-east and you are traversing the same spiral the field lives on —
the golden-direction walk and the escape-time gradient are two readings
of one arrangement.

### 3. The Fibonacci clock (essay #88) → `FibClock`, read against t-minus

`FibClock.advance()` queues one effect and ticks: n accumulates,
`clock.zeck` speaks its Zeckendorf decomposition, `clock.words` says it
aloud — *one, one, two, three, five, eight…* with compound hours:
4 → 'three-one', 7 → 'five-two'. The essay's clock keeps odd hours; so
does this one.

The A2A t-minus braid (`A2A/tminus-vector-braid.md`) is the same
instrument read in the other direction: a **countdown** vs an
**accumulation**. Two voices, one clock — and both ride the kernel tick,
so a braid's countdown and a clock's tab can be synced by construction,
not by convention.

### 4. The Twist commensuration comb → `convergentGaps()`

TWIST's instrument resolves golden-direction angles into a comb of
near-coincidences — teeth where F(n+1)/F(n)·360° almost closes on 360φ.
`golden.convergentGaps(n)` computes that ladder (no hand-measured values
anywhere — every degree number in the tests is computed):

| rung | ratio | gap |
|------|-------|-----|
| F₈/F₇ | 21/13 | −0.954° |
| F₉/F₈ | 34/21 | +0.365° |
| F₁₀/F₉ | 55/34 | −0.139° |
| F₁₃/F₁₂ | 233/144 | +0.0078° |

The comb closes on φ with alternating −1/φ decay — the same eigenvalue
as the word's length ratio, because it is the same matrix. TWIST and the
floor are one mathematics heard by two instruments.

### 5. The room takes the floor → `room.mjs`, RFC 0001's first tenant

`hostRoom(kernel)` admits a presence cell (`room.tap`) whose metadata
address is drawn from the shared phyllotaxis — the room takes its tile,
and no two cells share one. Presence is Z_in (the RFC's input primitive),
the tide is Vibe, clamped [−1, 1]. The RFC's room-as-cell stops being a
proposal: it is the first tenant of the floor, tested on both kernels.

### 6. The Strip — projection ≡ substitution (2D phase 1, pinned)

`strip.mjs` is the cut-and-project road to the same floor. Select lattice
points whose perpendicular offset `b − φa` falls in a window; project the
accepted points onto the golden line; the projection's spacings take
exactly two values whose order IS the Fibonacci word. Empirically pinned
constants (computation first, then locked by test):

- **The window is the tuning.** Widths 1/φ, 1, and φ all sing: exactly two
  spacings, ratio φ to 1e-12, the word, no BB/AAA, B-frequency → 1/φ².
  A near-miss width (1.25) gives ratio φ² and a different Sturmian
  sequence — anti-vacuity tested, so the tuning test means something.
- **Phase convention:** w0 = 0 begins one symbol before the word's seed A;
  the word reads from index 1 (that leading B is the westward witness).
- **The window is Zeckendorf-exact** (pinned, not prose): `zeckShift` gives
  ⌊aφ⌋ = ΣF(k+1) − ε with ε = 1 iff the least Zeckendorf index is even
  (the naive −1 dies at a = 2 — probes first, tests to a < 3000). Strip
  acceptance for a ≥ 1 falls out: **{aφ} > 1/φ²** — a Zeckendorf threshold.
  Column a = 0 is the boundary tile: the window's closed lower edge.
- **Self-similarity without substitution:** growing the lattice reach m
  reveals a longer prefix of the SAME bi-infinite sequence — the fractal
  essays' claim in another voice.
- **The affine identity:** strip intervals and FibFloor gen-8 tiles match
  under ONE constant scale across all 55 tiles — substitution and
  projection are two roads to one floor. This test caught a real bug in
  FibFloor: the naive "scale every child by 1/φ" rule drifts tile lengths
  into lineage-dependent values (three distinct lengths at gen 8). The
  true golden cut: a B grows into the new A *unscaled* — kind lengths stay
  uniform forever (A = φ⁻ᵍ, B = A/φ). Fixed, and a kind-uniformity test
  now guards it on both kernels.

Spacing values, for the record: S = φ³/SQ, L = φ⁴/SQ, SQ = √(φ²+1).

## The 2D floor — multigrid (phase 2, shipped)

The iceberg, surfaced. de Bruijn's construction over the kernel: N families
of parallel lines, `n_k·x = (j + γ_k)`, their dual = the Penrose tiling.
Everything below was pinned by probes (`/tmp/probe-mg*.mjs`) before any
assertion existed, and the suite keeps an anti-vacuity detuned grid to
prove the passing tests mean something.

**The dual, exact:** faces (index vectors of the arrangement cells) sit at
`x(j) = (2/N)·Σ (j_k + γ_k + ½)·n_k`; one dual edge per arrangement
segment, length exactly 2/5; dual tiles = the four face-corners around
each arrangement vertex. Two bugs the probes caught and the tests now
guard: cell indices are FLOORS not rounds (round() bent every downstream
constant), and lines must be split at crossings with out-of-reach parallels
else side-faces disagree and edges bend to 2φ/5. Tiles are exactly two
rhombi — thick (72°) and thin (36°) — core ratio converging to φ.

**The iceberg claim, adjudicated:** the 1D Fibonacci floor hides in every
direction of the crystal. The family-k dual edge-lines are parallel; their
intercepts take golden gaps

  S   = (2/5)·sin(2π/5)·φ⁻³ = 0.089806…
  L   = (2/5)·sin(2π/5)·φ⁻² = S·φ    = 0.145309…
  S+L = (2/5)·sin(2π/5)·φ⁻¹        = 0.235114…

(structural constants — identical at reach 4, 6, 8, 10, 12). In the patch
core consecutive gaps take exactly {L, S+L}, ratio φ, **no two L adjacent**
— the Fibonacci word law, one dimension up. The detuned grid (alternating
±2° normals) shows ≥3 distinct core gaps, smallest ratio 1.43, six tile
angles — the law discriminates.

**γ = 0 is singular:** 61 triple concurrences at reach 3 (generic γ: 0).
The dual stays edge-rigid (all 2/5) but concurrence vertices eat the
rhombi; the γ=0 patch is exactly centrally symmetric.

**Window:** perp-coordinates bounded, radius stable across reach — the
finite patch samples a fixed acceptance domain.

**Literature adjudication (2026-09-17):** the pins survive contact. de Bruijn
multigrid duals always satisfy the P3 matching rules; the infinite tiling's
thick:thin count ratio is φ (Wikipedia/MDPI Symmetry — φ² belongs to the
*areas* of subdivided Robinson triangles, not tile counts — our core pin
converging to 1.618 was right). Steinhardt's Ammann-quasilattice law (Eq. 1:
consecutive gaps L or S, L/S = φ, Fibonacci sequence) and the octagonal-
tilings paper's Appendix A.2 (subperiod norms "are L and S+L = φL") both
match our empirical {L, S+L} carrier pair. One tension, documented: the
Ammann bars are a *decoration* measured between families at 72°; our
carrier lines are orthogonal intercepts of the dual — same φ-singing
Fibonacci lattice per direction, different scale constants. Resolving the
apparent {L, S+L}-vs-{S, L} gap pair: S+L gaps are clipped middle lines;
re-inflating them (each C hides one line + one split) gives freq(L) →
16+20 / 57 ≈ 0.63 ≈ 1/φ — the Fibonacci word frequency. γ=0's singular
concurrences are de Bruijn's singular-shift case, consistent.

Hosting: arrangement vertices are kernel cells (`mg.v.{i}`), dual edges are
`fam{k}` links, parameters in `mg.params`. Both kernels.

## One clock, three meanings

Every subsystem ticks the same kernel clock, and that clock is itself
cell-addressed (`floor.gen`, `clock.n`, field `iter` per orbit). One ts,
three readings: generation (structure), moment (accumulation), iteration
(escape). This is the t-minus braid's promise kept inside one process.

## Roadmap — the 2D floor

1. ✅ **Cut-and-project** (phase 1, shipped): golden window pinned by test;
   the affine identity to FibFloor proven. Zeckendorf acceptance windows:
   membership is a condition on the fractional part {aφ} — the window
   boundaries ARE Zeckendorf thresholds (next test to pin).
2. ✅ **Multigrid** (phase 2, shipped): the Penrose crystal as kernel
   tenant; the golden-gap iceberg law above. Twist listener and field
   placement remain.
3. ✅ **Twist listener — SHIPPED 2026-09-17** (`src/twistlisten.mjs`): binds
   `twist.teeth` / `twist.gapRatio` / `twist.delta` / `twist.detuned`, exposes
   `listen(fn)` (L2 subscribe, contract-v5 private copies per listener). It
   measures the two smallest distinct core intercept gaps off the live
   multigrid — the true grid yields φ to fp precision at any reach, a
   detuned grid is flagged. `delta` = |gapRatio − best tooth|: the crystal
   hums exactly φ, the ladder climbs toward it, extending the comb shrinks
   the delta. Suite 79/79 on both kernels, incl. the deep identity
   err·F_n² → 1 (the classic |φ − p/q| < 1/q² convergent estimate).
4. ✅ **Field on the floor — SHIPPED 2026-09-17** (`src/penfield.mjs`,
   `tests/penfield.test.mjs`): Phyllomandel orbiters seated at core Penrose
   vertices (arrangement faces of the dual), c = the vertex position, one
   coherent z → z²+c per kernel tick, escapes counted as orbiters crossing
   the radius-2 horizon (gone = null, they stay gone). The address-space
   generalization is pinned as the **rank-2 golden module** (§8): projected
   vertex-address gaps are all m·p + n·q with atom ratio q/p = φ. Probed
   honest: the φ-ladder hypothesis (gaps = a·φᵏ) DIED — rung offsets −0.44 —
   and the module is what survives; the probe became the test. Detuned
   crystals fail to sing. 90/90 both kernels.

## Files

| file | what |
|------|------|
| `src/golden.mjs` | φ, Fibonacci word, Zeckendorf, convergent ladder |
| `src/address.mjs` | the shared phyllotaxis address space |
| `src/fibfloor.mjs` | the floor: deflate/reflate/walk, sedimentary time |
| `src/strip.mjs` | the same floor by projection: golden window, affine identity |
| `src/phyllomandel.mjs` | the field: orbits on the golden spiral |
| `src/fibclock.mjs` | the clock: Zeckendorf hours on the kernel tick |
| `src/comb.mjs` | TWIST's instrument as a live tenant (L2 subscribe) |
| `src/twistlisten.mjs` | twist listener — three voices, one φ; L2 `listen()` |
| `src/penfield.mjs` | field on the floor — orbiters at Penrose vertices; Z[φ] module |
| `src/multigrid.mjs` | the 2D floor: de Bruijn multigrid → Penrose dual, golden gaps |
| `src/room.mjs` | the tenant: room-as-cell on the floor |
| `tests/*.test.mjs` | 70 tests × both kernels; golden math pinned separately |

## 8. The field on the floor — rank-2 where the floor was rank-1

Phase 4. The 1D field seats orbiters on a Vogel spiral: one index, one
golden angle, address `i` ↦ polar projection. The 2D floor generalizes the
address space: every core Penrose vertex (an arrangement face of the
multigrid dual) hosts an orbiter whose complex parameter c IS the vertex
position. One kernel tick advances z → z² + c across the whole vertex
field coherently; orbiters crossing the radius-2 horizon are null and stay
null — the sea does not run backward (inverse: documented no-op, same
honesty as the 1D field).

**The address law, probed and pinned.** Read the vertices' projected
addresses along any grid direction and take consecutive gaps. The first
hypothesis was a φ-ladder — gaps a·φᵏ — and it DIED in the probe: the rung
offsets came out −0.44, not integers. What survives is the rank-2 golden
module: the distinct gaps have two atoms p < q with q/p = φ to 1e-9, and
every gap is m·p + n·q for small integers m, n (search-pinned, exact to
1e-9, with at least one element needing both atoms — genuinely rank 2).
The 1D floor's alphabet was a word over two letters; the 2D vertex address
alphabet is their integer span. A detuned crystal leaves the module — the
law discriminates, as every floor law must.

## 9. Scaling — one machinery, many alphabets, and the lift as the code

Casey's challenge (2026-09-17): Penrose generalizes to arbitrary dimension;
abstract high-dimensional structure can be encoded INTO the locational
tiling; interference + twisting open compression and seek-time reductions.

What the floor proves today, probe-pinned (tests/nscaling.test.mjs):

**One machinery, many alphabets.** The multigrid class is N-generic, and
the probe scaled it without a single geometry fix:
| N | crystal | edge law | gap ring |
|---|---------|----------|----------|
| 5 | Penrose | exactly 2/5 | Z[φ] — rank 2 |
| 7 | heptagonal | exactly 2/7 | Z[2cos π/7] — ratios 1.80194, 1.24698 pinned |
| 8 | Ammann–Beenker | exactly 2/8 | Z[√2] family |
| 10 | decagonal | exactly 2/10 | 1+2cos(π/10) = 2.90211 pinned |

Every N-fold symmetry brings its own algebraic number field — its own
compression alphabet — and the SAME code sings all of them.

**The interference pattern.** The arrangement literally is one: N phase
gratings, and quantize(p) = (⌊nₖ·p − γₖ⌋) demodulates any point into its
Z^N lift in O(N) floor operations. Probed honest: interior points
round-trip 100% (7670/7670 — constructional), and the strip-center K(j)
resolves within exactly one dual edge (max 0.400000 = 2/N), because de
Bruijn's least-squares point is not an interior guarantee (2057/3069 — a
theorem-memory corrected by probe, as designed).

**The hologram, literal.** A 2D location encodes its full N-dimensional
preimage: LocStore writes payloads by lift (the Z^N address) and reads them
by any 2D point in the face — zero seek, the geometry is the index. This
IS the "child's-play holographic principle": the part carries the whole's
coordinates, verifiably.

**Built next / not yet built.** A genuine 3D icosahedral crystal (Z⁶
projected to R³ — the real quasicrystal) needs the multigrid embedded in
R³ instead of R²; the mathematics transfers wholesale (faces ↔ vertices,
same dual, same lift machinery) but normals/positions are 3-vectors.
Higher-rank alphabets (N=7's rank-3 ring) suggest richer per-symbol
payloads — the compression story Casey is pointing at — but symbol-coding
capacity is NOT yet pinned. The scaling law that IS pinned: alphabets grow
with N, machinery doesn't.

## 10. The twist field — twist-engine's instrument seated on the floor

The two repos share ONE instrument now. twist-engine app.js defines
registration R = mean gaussian alignment (σ = 0.24·s, spatial hash at
0.6·s, s = mean nearest-neighbor spacing). `src/twistfield.mjs` runs that
EXACT law on the Penrose vertex set: rotate the core vertices by θ,
measure alignment against the unrotated floor. Laws, probe-pinned
(tests/twistfield.test.mjs):

**Identity.** R(0) = 1 to 1e-12.

**The cloud law.** For θ ≲ 2°, R(θ) ≈ exp(−⟨r²⟩θ² / 2σ²) — each rotated
point's nearest is itself, displacement r·θ, gaussian-averaged. Verified
against measured values to 0.06% at 1° and 0.89% at 2°, with ⟨r²⟩ taken
from the data (2.1866 at reach 8), not asserted.

**The fingerprint.** Beyond ~2.5° truth deviates UP from the cloud law —
rotated vertices land near OTHER vertex species, and the deviation grows
monotonically through 6°. The deviation curve is the lattice's rotational
fingerprint, and it is γ-independent (two generic offsets agree within
tolerance): universal for generic floors.

**Killed by the same probe** (the discipline cuts both ways):
- Fine magic-window teeth in 0–1°: NONE at 0.02° resolution. The golden
  lattice's twist falloff is smooth. (The comb's teeth live in
  spacing-space — a different parameter; both truths coexist.)
- Large-θ commensuration peaks: the naive sweep's S-minimum sits at 24°,
  but that is a disk-rim artifact — the finite viewport swamps registration
  beyond σ/r_max ≈ 2.2°. twist-engine itself only runs θ ∈ [0.15°, 6°];
  the floor instrument stays in the same validated regime.

Synergy: the floor gives twist-engine a quasiperiodic substrate with
locational codes; twist-engine gives the floor a commensuration
instrument. QUILT_NOTES.md's theorem — "both count the holes" — now has a
second shared object: both measure the alignment.

## 11. The analogue seam — IARS (spline.mjs)

The fleet's spaces are exact discrete worlds stitched by ad-hoc teleports.
`src/spline.mjs` is the missing continuous layer between them, under one
doctrine: **integers own identity; rationals own motion; floats only
measure.**

- controls = native identities, lifted to ℚ (exact integers preferred)
- knots = ℚ — knot multiplicity is the smoothness dial (mult k ⇒ C^{p−k})
- weights = ℚ — the 3-4-5 arc (cos Δ/2 = 4/5) makes a rational quadratic
  an EXACT circle: every evaluated point satisfies |p−c|² = r² with a
  BigInt zero, no tolerance. Non-Pythagorean weights have no rational
  shadow: measure honestly, flag it (same stance as π in golden.mjs)
- evaluation = BigInt-rational de Boor (Piegl A2.1–A2.3) — no f64 in the
  pipeline; a discrete hop (`snap`) is the rounding of a continuous motion,
  derived, never hand-carried
- derivatives are exact rationals: C′ and C″ feed `curvatureMeasure`
  (κ = |det(C′,C″)|/|C′|³) — the v4 fabric grammar's Δ_max kill-veto reads
  from here; the dersBasisFuns row-swap lives INSIDE the k-loop (A2.3),
  and a row-shape test pins the [null,null,2] corruption class that would
  otherwise silently null every curvature veto
- arc length is a MEASURE (`arcLengthMeasure`, adaptive Simpson on the
  exact speed function) — a float, never an identity
- tenancy: `hostTrace` hosts n+1 samples as cells — float x,y is the view,
  the ℚ lift is the identity, motion is `next` links — and the hosted
  trace is byte-identical on both kernels

Pinned by tests/spline.test.mjs, both kernels, including two anti-vacuity
proofs: a 9/10 weight breaks the exact-circle property (the Pythagorean
specificity is load-bearing), and float contamination (0.8 ≠ 4/5) breaks
exactness (the rationals are load-bearing, not decoration).

Synergy: quilt-gan's fabric arcs stop being hand-bowed quadratics (the
chord metric was hiding 4.1% of communication cost) — they become exact
rational arcs with a true arc-length referee. B2 twist-along-arc and B3
ℚ¹⁶ breed trajectories (the duke-lab/tidepool 16-dim collision) sample
along this seam with no coordinate change.

## 12. The twist along the seam — B2 (twistfield.mjs, the instrument generalized)

twist-engine rotates about the ORIGIN. Between two quilt spaces the rotation
center GLIDES along the seam — so the instrument is generalized, semantics
verbatim otherwise: `registrationAbout(c, θ)` rotates about an arbitrary
station, and `TwistField.sampleAlong(curve, {n, θ})` samples the twist
budget along an IARS arc. Laws (tests/twistalong.test.mjs, tolerances
measured by probe 2026-09-19):

**Center equivariance.** About c = 0 the generalized instrument recovers
registration(θ) bit-for-bit.

**The cloud law carries to ANY station — per-point.** A rotation about c
displaces point p by exactly |p−c|·θ, so while "nearest is itself" holds,
R ≈ mean_p exp(−|p−c|²θ²/2σ²). This tracks the instrument to 0.35% at
every station tried (centroid to off-disk), θ ≤ 2°. The naive ⟨r²⟩
closed form does NOT carry: it degrades to 15.7% at the off-disk station
at 2° — pinned as an anti-vacuity proof. The Jensen gap is geometry; the
seam law must be per-point.

**The alignment budget decays along the seam.** Marching the station
outward, R decreases strictly and is halved by the rim at 2°.

**The fingerprint reproduces about a moving center.** Beyond the twist
regime the deviation from the per-point cloud is positive and grows
3°→6°, about the centroid and about (0.9, 0.3) alike — cross-alignment
is a property of the lattice, not of where you stand on it.

**The full seam loop closes on both kernels.** spline → hostTrace → read
stations back from the hosted trace AND from the ℚ lift AND from direct
ℚ sampling — three paths, bit-identical instrument readings. The kernel
tenancy is lossless for the analogue instrument; the hosted trace IS the
seam's substrate.

Synergy: B2 is the flagship seam — quilt-gan's fabric arcs become seams
the twist instrument can read; hermit's canon edges get an alignment
budget; B3's ℚ¹⁶ breed trajectories sample along the same law.

## 13. The hodograph seam — PH cubics (ph.mjs), beyond pythagoreanArc

Section 11's pythagoreanArc pins an exact CIRCLE: point membership is BigInt
zero, but the arc length carries π. Section 13's PH cubics trade the circle
for the measure: the hodograph is a perfect complex square, c′(t) = (a +
b·t)² with a, b ∈ ℚ[i] (Farouki, *Pythagorean-Hodograph Curves*, 2008), so:

- **speed** σ(t) = |a + b·t|² is a real quadratic with ℚ coefficients;
- **arc length** s(t) = ∫₀ᵗ σ is a cubic closed form — one Horner pass in
  BigInt. No integral, no Simpson, no π. Exact where the 3-4-5 arc never was;
- **curvature** κ(t) = 2·Im(b·conj(a + b·t)) / σ(t)² is a rational function —
  exact ℚ at every station, so the Δ_max kill-veto reads truth, not samples.

The honest gate: endpoint interpolation (PH Hermite) solves a = (−b +
√(4d − b²/3))/2 in ℚ[i] only when the discriminant is a rational square
(ratSqrt, commensurate.mjs). The fabric's perpendicular bow on an axis chord
generically FAILS that gate — the denominator of 4L + q²/3 carries an odd
power of 3 (side 0.1, chord 8 → 2416/75). phFromChord flags exact: false and
shadows the same law in f64 rather than faking ℚ. Laws pinned in
tests/ph.test.mjs (8 tests): canonical hodograph length 4/3 as BigInt zero,
κ(0) = 2 exact + measured cross-check, anti-vacuity (length ≠ chord under
bow), both-kernel tenancy with ℚ lift provenance.

**Synergy this opens:** v5 fabric — replace Simpson's arcLengthMeasure with
the PH closed form and the fixed ±0.16 bow with a chord-proportional PH bow:
the v4 hairpins (κ = 6.75 on chord-0.09 arcs, smoke-v4) die by construction,
not by judge tolerance.
