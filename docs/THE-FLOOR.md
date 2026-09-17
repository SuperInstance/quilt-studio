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

**Time travel.** Reflation is `kernel.undo()` — which, since contract v4,
covers `bind` as well as effects. Undoing a fresh bind removes the cell
(the address never existed); undoing an overwrite restores the prior
value. `reflate(2)` costs O(generations) undos, and re-deflating
overwrites sediment with identical values — the regrow test compares
full JSON. History IS the future.

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

## One clock, three meanings

Every subsystem ticks the same kernel clock, and that clock is itself
cell-addressed (`floor.gen`, `clock.n`, field `iter` per orbit). One ts,
three readings: generation (structure), moment (accumulation), iteration
(escape). This is the t-minus braid's promise kept inside one process.

## Roadmap — the 2D floor

1. **Cut-and-project** from Z² along the golden line: acceptance windows
   via Zeckendorf terms (already exact in `golden.mjs`), test: window
   membership ⇔ tile kind.
2. **Multigrid**: 5 grids at 72°, rhombic cells as kernel cells, test:
   vertex figure and Ammann bars.
3. **Twist listener**: feed `convergentGaps` teeth into a live kernel
   cell, let a render view (L2 `subscribe`) draw the comb as it computes.
4. **Field on the floor**: place Phyllomandel orbiters at 2D floor
   vertices — the address space generalizes (Vogel → Penrose vertex
   numbering).

## Files

| file | what |
|------|------|
| `src/golden.mjs` | φ, Fibonacci word, Zeckendorf, convergent ladder |
| `src/address.mjs` | the shared phyllotaxis address space |
| `src/fibfloor.mjs` | the floor: deflate/reflate/walk, sedimentary time |
| `src/phyllomandel.mjs` | the field: orbits on the golden spiral |
| `src/fibclock.mjs` | the clock: Zeckendorf hours on the kernel tick |
| `src/room.mjs` | the tenant: room-as-cell on the floor |
| `tests/*.test.mjs` | 35 tests × both kernels; golden math pinned separately |
