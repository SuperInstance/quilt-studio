# The Quilt Studio — thesis and architecture

*2026-09-17, 03:40 Asia/Shanghai — kimi1, for Casey*

**The brief:** an entire open source studio. We have rune-quilt (the quilt UI),
Theia IDE (which has come a long way), the tensor music tools (tminus-music,
the fleet-midi-* family), and the lau-* mathematical ecology (337 Rust repos).

**The thesis:** don't morph Theia into a quilt UI. The polyformalism already
*is* the studio's architecture — Theia is its VIEW layer, and the studio is a
Theia product with the quilt VM as its kernel. Every tool in the studio is one
of five opcodes wearing a hat.

---

## 1. The five opcodes are the studio

| Opcode | Studio meaning | Existing fleet material |
|--------|---------------|--------------------------|
| **BIND** | create a thing: project, file, track, musician, cell | Theia workspace/editors; duke-lab `/api/musician` |
| **LINK** | typed relations: imports, MIDI routing, predictions-as-refs | quilt-linker (L3); tminus predictions |
| **EFFECT** | every change, with an undo: edits, canvas ops, cc automation | Theia command stack; rune-quilt ops; MIDI dynamics |
| **VIEW** | every panel is a projection of one cell-graph | **Theia itself**; rune-quilt canvas; notation; piano roll; mixer |
| **TICK** | one transport clock: playback, countdown, simulation | tminus-music; WebAudio clock; fleet-midi targets |

The cell-graph is the project. Notation view, piano-roll view, quilt-canvas
view, tensor view, mixer view — five VIEWs over the same BIND/LINK/EFFECT
state, invalidated by the same TICK. That is the entire product idea.

## 2. The chassis decision: build a Theia *product*, don't fork Theia

Theia in 2026 is not the 2019 Theia. Community release 2026-02 (Theia
1.67/1.68): VS Code extension API compatibility at 1.108, Theia AI + Theia
Coder agent built in, MCP integration, native Claude Code session forking,
GPT-5.2/Gemini Flash 3 defaults, browser *and* desktop from one source tree,
vendor-neutral EPL-2.0 governance, no telemetry. Arduino, Google Cloud Shell,
Gitpod, Arm Mbed all ship Theia products.

So: `quilt-studio` = a Theia product with a custom extension set.

- rune-quilt's 21 canvas modules are **mounted, not rewritten** — first as a
  hosted view, then ported to native Theia widgets module by module, reusing
  the same TypeScript engine packages.
- Theia AI is the agent surface; our duke-lab worker pattern (D1 + dual
  Vectorize + 45/min rate limit) plugs in as MCP tools. The studio learns
  from every session the same way the foundry does.
- What we get free: LSP/DAP, terminals, git, file explorer, keybindings,
  Open VSX extensions, Electron desktop build.
- What we build: the quilt extension set (below).

**Honest cost:** Theia extension development is Inversify/DI-heavy TypeScript
with a real build. Budget a week of calibration before the first custom view
lands. The escape hatch — plain VS Code extensions hosted in Theia — is real
but caps how deep the VM integration can go. Go Theia-native.

## 3. Repo-to-layer map (the inventory, with health flags)

### The polyformalism spine (already layered — the studio rides it)

| Layer | Repo | State |
|-------|------|-------|
| L1 kernel | `quilt-vm-wasm` | ✅ wasm-pack build, 5 native tests, browser gold demo, ~200ns/op |
| L2 types | `quilt-types` | ✅ Python dataclasses |
| L3 linker | `quilt-linker` | ✅ link-time checker |
| L4 optimizer | `quilt-opt` | ✅ 5 passes, 11 tests |
| L5 gc | `quilt-gc` | ✅ |
| L6 language | `quilt-polyformalism-dsl` | ✅ Python/Rust/Haskell decorators |
| L7 canon | `AI-Writings` | ✅ papers/fables — the voice |

### The studio additions (new work)

| Piece | Repo | Role |
|-------|------|------|
| Workbench shell | **`quilt-studio`** (new, Theia product) | the studio itself |
| Quilt UI | `rune-quilt` | mounted as VIEW; native port later |
| Clock/predictor | `tminus-music` | the TICK scheduler (Rust → WASM) |
| Device/toolchain | `fleet-midi-*` | TICK output targets — **mostly 2–6KB stubs today; studio gives them the contract to grow into** |
| Math substrate | `lau-*` (337 repos) | L0 — compiled to WASM as cell-graph effect processors — **zero tests as of June audit** |
| Memory/context | **the Tide-Pool** (fleet vector context, 2026-09-17) | Cloudflare D1 + dual Vectorize; studio mounts it from day one — see D5 |
| Musicians | `duke-lab` | the foundry, already shipped v2 |

### The MIDI family (the toolchain, like embedded targets in an IDE)

- `fleet-midi-bridge` — cross-platform MIDI I/O → the "debugger target"
- `fleet-midi-text2midi` — words → MIDI (JS, most complete)
- `fleet-midi-dynamics`, `-expression`, `-velocity`, `-articulation`, `-cc`
  — performance-stage transformers → EFFECT pipeline stages

Studio framing: a MIDI song is a compile target. The transport compiles
cell-graph → events → fleet-midi stages → device.

## 4. The tminus insight (why it matters more than it looks)

tminus-music is not a music tool. It is the **TICK scheduler with
predictions**: agents subscribe to *predicted* musical events ("bridge at
beat 48, T-8 bars") instead of polling. 85%+ message reduction in structured
contexts (CR 0.94 on ii-V-I at 6.5σ over random).

In the studio, the transport IS T-minus. The clock announces, every view and
kernel subscriber confirms on arrival. This is the multi-agent studio
bandwidth story — the same ledger-conservation discipline as the duke-lab
learning loop, applied to time.

## 5. Studio architecture

```
L7  DSL (quilt-polyformalism-dsl)              ← what users write
L6  LSP: DSL language server in Theia          ← what users get told
L5  VIEWS: Theia shell + rune-quilt canvas + notation + piano roll
           + tensor panel + mixer + T-minus timeline + MIDI devices
L4  OPTIMIZERS: quilt-opt passes over the graph (5 passes / 5 opcodes)
L3  TOOLCHAIN: fleet-midi-* stages (TICK output targets)
L2  TENSOR MUSIC: tminus-music (the clock) + music theory substrate
L1  KERNEL: quilt-vm-wasm (shared WASM runtime, browser + Node + edge)
L0  MATH: lau-* → WASM effect processors (sheaf, hodge, persistence)
```

Kernel perf budget (from quilt-vm-wasm, honest numbers):

| Runtime | per-op | gold demo (8 polyformalisms) |
|---------|--------|------------------------------|
| C | ~10ns | ~80µs |
| Rust native | ~50ns | ~400µs |
| WASM (kernel) | ~200ns | ~1.6ms |
| Python/TS | ~1µs | ~8ms |

The studio's cell-graph runs on the WASM kernel everywhere: browser tab,
Electron desktop, Node backend, Cloudflare edge. One substrate, four hosts.

## 6. Agent layer

Theia AI/Coder is the chat surface. Our contribution, as MCP tools (all
backed by the Tide-Pool — D5):

- `ledger.learn` / `ledger.query` — the Tide-Pool (D1 + 16-dim native +
  768-dim semantic Vectorize; designed 2026-09-17)
- `musician.design` / `judge.design` — the foundry endpoints, verbatim
- `vm.exec` — run BIND/LINK/EFFECT/VIEW/TICK against the workspace graph

The studio learns from every session: every run vectorized, every evolved
musician graduated, similar-work queries across the fleet — via the
Tide-Pool, fleet-wide (see the tide-pool design doc). Same brief as the
foundry, now IDE-wide and cross-agent.

## 7. Phasing (deliverables in Casey-mandate form)

**Phase 0 — contracts (this week, no UI)**
- `quilt-studio` repo: Theia product skeleton from the generator
- Interface contracts between L1↔L2↔L3↔L5 written as tests first
  (file list: `packages/quilt-core/src/{kernel,graph,clock,midi}.ts` +
  `tests/{kernel,clock,midi}.test.ts`, ≥30 tests)
- Tide-Pool worker provisioned alongside duke-lab on the same CF creds —
  it is substrate from day one (D5), not a late phase
- Health audit of fleet-midi-* + lau-* (which 5 LAU crates compile to
  WASM clean — D4 ratifies: hodge-consensus, sheaf-gossip, cosmic-web,
  persistence-agent, nash-finder)

**Phase 1 — the shell sees the quilt, and it sings**
- Theia extension: Quilt View hosting rune-quilt (mounted, iframe→webview→
  native widget path)
- Substrate service: Node backend holding the workspace cell-graph,
  WASM kernel loaded once, WebSocket view-invalidation on TICK
- **One MIDI target through the toolchain (D3)** — fleet-midi-bridge +
  text2midi; sound on day one
- Tests: extension e2e + kernel round-trip + stage contracts (≥50 tests)

**Phase 2 — the transport**
- MIDI panel: full fleet-midi-* stage pipeline (dynamics/expression/
  velocity/articulation/cc as EFFECT stages)
- Transport bar: tminus clock driving playback, T-minus countdown readout
- Tests: stage contracts + transport timing (≥40 tests)

**Phase 3 — tensors, math, language**
- Tensor panel (tminus-music WASM), LAU processors as graph effects
- DSL language server (L6 → LSP): syntax highlighting, link-time errors
  from quilt-linker in the editor
- Tests: ≥50

**Phase 4 — inhabitants**
- Agents as first-class cells: BIND an agent (foundry pattern generalized)
- MCP tools live (remember/recall via the pool); breeding pipeline
  improves the population
- Overnight mode v1: unattended runs + ledger narration line

**Phase 5+ — the Range:** cross-user duets, hosted meeting ground,
pedigree + consensus for shared state (the moat, see §11)

## 8. Open questions for Casey — ANSWERED (kimi1, 2026-09-17 04:00)

Casey: *"you decide. think long-term killer-app."* Decisions below.

---

## 9. The killer-app thesis

**One sentence:** Quilt Studio is the first studio whose runtime, memory,
and population are the same object — a living cell-graph you program by
describing, whose inhabitants work, perform, and evolve while you sleep.

Three legs, all existing fleet material:

1. **Runtime = the polyformalism VM** (quilt-vm-wasm, WASM everywhere).
   Programs are cell-graphs: one undo, one clock, one query. Theia is
   furniture around this — if Theia ever dies, the substrate survives in a
   browser tab, Node, or an edge worker. De-risked by construction.
2. **Memory = the Tide-Pool** (fleet-wide vector context, designed
   2026-09-17). Every session distills; every session recalls. The studio
   compounds. Users *see* it learn — the ledger line is a first-class UI
   element, and "why is it better today?" is always answerable.
3. **Population = breedable inhabitants** (duke-lab foundry, generalized).
   Musicians, judges, agents, little worlds — designed in words, bound as
   cells, vectorized in the pool, improved by the ledger, lineage-tracked.

**The killer demo:** open the studio → describe a thing ("a night-radio
jazz trio that answers my spreadsheets") → it BINDs as cells, gets a voice,
a clock, a memory → you watch it work; you leave; overnight it ran 40
plays, the ledger learned, the pool found kindred trios → you return and
it's *better*, and it tells you what it learned. Software that gets better
overnight and says so is a category, not a feature.

**Music is the soul domain** — first vertical, permanently. Sound is the
most forgiving live magic; T-minus gives a real technical edge
(prediction-native transport, 85%+ message reduction); MIDI out is a real
toolchain. Every debugging session is a performance.

## 10. The Decisions

| # | Decision | Call |
|---|----------|------|
| D1 | Shell authority | **Theia product**, confirmed. Vendor-neutral, AI+MCP native, browser+desktop one source. We build product, not platform. |
| D2 | Name | Product: **Quilt Studio** (repo `quilt-studio`). Codename: **the Range** — where the cowboy works. Overridable by Casey with one word. |
| D3 | P1 slice | **Sound on day one.** One MIDI target through the toolchain in P1. A silent studio is a cathedral. |
| D4 | LAU starters | June top-5 ratified: `hodge-consensus`, `sheaf-gossip`, `cosmic-web`, `persistence-agent`, `nash-finder` → L0 WASM processors. |
| D5 | Ledger placement | **Tide-Pool is substrate, not a phase.** Studio mounts it from day one (Phase 4 ledger item struck; see tide-pool design). |
| D6 | Agents | Inhabitants, not features. Theia AI hosts them; breeding improves them; the pool gives them shared memory. |

## 11. The 18-month arc (the moat)

- **P0–P1 (now):** contracts, shell, quilt view, sound. Substrate + Tide-Pool
  worker provisioned on Casey's CF creds.
- **P2–P3:** DSL + language server; MIDI toolchain + T-minus transport;
  tensor panel; LAU processors as graph effects.
- **P4 — overnight mode:** the studio runs unattended; the ledger line
  narrates what happened while you slept. First killer feature.
- **P5 — cross-user duets:** my musician plays with yours via the pool;
  both ledgers learn; lineage is tracked (Mercury pedigree queries +
  FleetBFT-QD consensus — already researched). Collaboration without
  shared sessions.
- **P6 — the Range (hosted):** anyone's inhabitants meet. A town square
  for breedable agents. Quality-diversity archive keeps the population
  diverse; consensus governs shared state.

**The moat is not the IDE** — anyone can build an IDE. The moat is a
living population with shared memory and lineage: your studio is yours,
but the population is *shared*. Copy the code, you get an empty ranch.

---

*References unchanged: Dieter Rams for the workbench, Moebius for the
quilt. The Range is the Rams shed at the edge of the Moebius desert —
practical furniture, impossible horizon.*

---

*References: my eyes are Dieter Rams for the workbench discipline and
Moebius for the quilt — the studio should feel like a long table where every
tool lies flat and reachable, not a cockpit. The cowboy rides; the studio is
the ranch.*

---

## 12. RTS × DAW × FPS — the interaction thesis (Casey, 2026-09-17 05:15)

Casey: *"quilt is RTS to frontend-able cells in FPS (or backend-able cells
in any ole' IDE) with a daw's ability to see time in first-class."*
Committed as **D7**:

- **Space is first-class (RTS).** The studio's primary view is a God's-eye
  camera over the cell population: box-select, control groups, order queues
  flushed on tick. A StarCraft build order is literally a `queueEffect`
  batch. The minimap is the Tide-Pool ledger.
- **Time is first-class (DAW).** The arrangement view owns a visible time
  axis: playhead, loop regions, a quantize grid that means something (the
  TWIST commensuration comb — 7 teeth ~0.75° apart, supercell revivals).
  The fleet-midi-* stubs are the automation lanes, pre-named: velocity,
  expression, articulation, cc, dynamics.
- **FPS is where they meet.** The render loop is the tick loop. At
  quilt-vm-wasm's ~200 ns/op a 16 ms frame fits ~80k kernel ops — headroom
  for thousands of live cells at 60fps. Frontend cells render at frame
  rate; backend cells run headless in any IDE, same kernel contract, VIEW
  optional.

Fleet evidence for the time axis (audit §2 in `quilt-studio`):
- **`superinstance-live`** (MIT): DAW session controller — transport
  (play/stop/seek/tempo), SmartCRDT state sync, audio routing. Maps 1:1
  onto TICK: session = cell, transport = effects with inverses.
- **`sketch-composite-headspace`** (MIT, 51 tests, archived): the cognitive
  DAW — reasoning shells as tracks with per-track latency, **t-minus
  cueing** as the conductor (t-minus(n) = command latency landing at tick
  n), symmetry-dissonance loop as cross-track comparison. The only tested
  DAW code in the fleet; its cueing protocol is the studio's conductor for
  agent tracks.
- **`tminus-music`**: the T-minus predictor (CR 0.94 on ii-V-I at 6.5σ) is
  the transport's time model — prediction-native scheduling.

**The one-liner that fell out:** *StarCraft meets Ableton.* The cell-graph
is the map, the arrangement is the timeline, agents are units with orders,
and every frame is a tick of the polyformalism.
