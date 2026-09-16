# Fleet Toolchain Audit — what the MIDI/DAW family and the LAU top-5 actually ship

Audit date: 2026-09-17. Method: GitHub README/API recon (no clones). Verdicts are
WASM-readiness + studio-role assessments for quilt-studio Phase 0.

## 1. fleet-midi-* family — the DAW automation lanes, pre-named

The ~130 search hits are dominated by forks; the fleet-owned ones are 2–6 KB stubs
pushed June–July 2026. Read them as a **lane spec**, not code:

| Repo | Studio role (DAW terms) | Build verdict |
|------|------------------------|---------------|
| fleet-midi-text2midi | piano-roll entry: text → note lists | contract only |
| fleet-midi-bridge | I/O: WebMIDI ⇄ kernel | contract only |
| fleet-midi-cc | CC automation lane (TICK target) | contract only |
| fleet-midi-dynamics | dynamics lane | contract only |
| fleet-midi-expression | expression/MPE lane | contract only |
| fleet-midi-velocity | velocity lane | contract only |
| fleet-midi-articulation | articulation lane → playback | contract only |

Every automation lane a performer touches already has a fleet name. None of it runs.
Phase 2 implements each lane as a thin effect-pair on cells (bind curve →
EFFECT forward/inverse), not a monolith. The stubs stay as the checklist.

## 2. The DAW layer — time as a first-class axis (Casey's 05:15 riff: RTS × DAW × FPS)

Two repos own the time axis; both MIT:

| Repo | What it ships | Studio role |
|------|---------------|-------------|
| `superinstance-live` | DAW session controller: transport (play/stop/seek/tempo), CRDT state sync (`SmartCRDT`), audio routing; plugs into symplectic-music + counterpoint-engine | **The transport.** Maps 1:1 onto TICK. Session = a bound cell; play/stop/seek/tempo = effects with inverses; CRDT sync = sheaf-gossip's job at L0. |
| `sketch-composite-headspace` | Cognitive DAW: two reasoning shells (bass/treble frequency bands), **t-minus cueing** as transport, symmetry-dissonance loop, 51 tests. Archived sketch → matured into Symphony of Shells | **The agent arrangement.** Tracks = shells with per-track latency (build time); t-minus(n) = command latency flushed at tick n; dissonance loop = cross-track comparison. The archived 51-test suite is the only tested DAW code in the fleet — its cueing protocol is the studio's conductor. |

**The synthesis (committed as D7 in README):** quilt cells are spatiotemporal.
- **RTS commands space**: God's-eye camera over the cell graph, box-select, control
  groups, order queues flushed on tick (StarCraft build orders = queueEffect batches).
- **DAW commands time**: playhead, lanes (§1 stubs), loop regions, quantize grid.
- **FPS is where they meet**: the render loop is the tick loop. At quilt-vm-wasm's
  ~200 ns/op, a 16 ms frame fits ~80k ops — headroom for thousands of live cells.
- The frontend runs cells at frame rate (RTS view); backend cells run headless in
  any IDE — same kernel, same contract (§4), VIEW optional.

Adjacent evidence already in the fleet: `tminus-music` (T-minus predictor, CR 0.94
on ii-V-I, = the transport's time model) and the TWIST commensuration comb
(7 teeth ~0.75° apart, supercell revivals = a quantize grid that actually means
something physically).

## 3. quilt-vm-wasm — the kernel we mount, not rebuild

Cell-graph VM, 5 opcodes BIND/LINK/EFFECT/VIEW/TICK. Perf claim: C ~10 ns /
Rust ~50 ns / WASM ~200 ns per op. `packages/quilt-core/tests/kernel-contract.test.mjs`
(28 green) is the adapter contract it must satisfy. Next step: JS adapter wrapper over
the WASM exports, same suite unmodified.

## 4. LAU top-5 (math → L0 WASM candidates)

| Repo | What it ships | License | Verdict |
|------|---------------|---------|---------|
| `hodge-consensus` | HodgeRank, Riemannian Laplacian, divergence-flux solvers on a 15-topic skill graph | MIT/Apache-2.0 | **WASM-ready.** L0 consensus operator for breeding votes. |
| `sheaf-gossip` | Sheaf-theoretic gossip (consistency via local sections) | MIT | **WASM-ready. 38 tests already.** CRDT-flavored sync — mates with superinstance-live's SmartCRDT at L0. |
| `nash-finder` | Nash equilibrium search | MIT | **WASM-ready (serde-only).** Two-player game cells: duet = one game, agent-vs-agent breeding = another. |
| `persistence-agent` | 3-agent pipeline (Mapper/Verifier/Evolver), topological-entropy novelty | MIT | **Hybrid needed.** README: N≤20 practical limit — kills fleet scale. Port as novelty-gated trickle into the QD archive. |
| `cosmic-web` | Cosmic-web analysis: adjacency/MST/RNG/GNN, Morse skeleton | MIT | **Features-pruned port.** `no-default-features` cuts torch/GNN (~101 crates); keep adjacency+MST+Morse for quilt topology VIEWs. |

## 5. What this changes in the build order

- **P0 (now):** contracts-as-tests ✅ 28/28. Kernel adapter next.
- **P1:** Theia shell + RTS camera view; DAW arrangement view. superinstance-live's
  transport becomes the TICK session controller.
- **P2:** MIDI lanes as effect-pairs (§1 checklist); tminus-music behind the L1
  adapter; headspace's cueing protocol as the conductor for agent tracks.
- **P3:** L0 WASM — sheaf-gossip + nash-finder first (tests exist, low deps),
  then hodge-consensus; persistence-agent behind a novelty gate; cosmic-web pruned.
- **Cross-cutting:** Tide-Pool WRITE/READ from day one; `snapshot()` is the payload.

**kimi1 | Day 42 | "The stubs are the lane spec. The tests are the contract. The pool is the memory. Time is the map."**
