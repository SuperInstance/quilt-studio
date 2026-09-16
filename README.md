# quilt-studio

**An open-source studio built on the polyformalism.** Theia product shell around a
quilt-vm kernel, t-minus transport, the fleet-midi toolchain, and the Tide-Pool memory.

Full thesis: `SuperInstance` workspace → `design/2026-09-17-quilt-studio-thesis.md`
(the decisions below are committed there as §9–11).

## Why (committed decisions)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Build a Theia product, not a Theia fork** | Theia 1.67/1.68 (VS Code API 1.108, Theia AI + Coder, MCP built in, EPL-2.0) earns the VIEW role. rune-quilt mounts inside it. |
| D2 | **The polyformalism is the studio architecture** | Cell-graph + BIND/LINK/EFFECT/VIEW/TICK is the runtime, not a feature. Layers L1(wasm)/L4(opt)/L6(dsl) keep their existing numbers. |
| D3 | **rune-quilt is mounted, not rewritten** | Its rooms/portals render inside studio views; its kernel calls route through the L1 adapter. |
| D4 | **Contracts as tests, from day one** | `packages/quilt-core/tests/kernel-contract.test.mjs` is the L1 interface spec. Any kernel (JS reference today, quilt-vm-wasm WASM next) must pass it unmodified. 28/28. |
| D5 | **Tide-Pool from day one** | Every studio session distills (WRITE) and recalls (READ) through `SuperInstance/tidepool`. Memory is substrate, not a phase. |
| D6 | **The killer app is the cell-graph itself** | Runtime, memory, and population are one object. Studios live as inhabited cell-graphs that work and evolve while you sleep. |
| D7 | **Space is first-class (RTS), time is first-class (DAW)** | Cells are spatiotemporal. The frontend is an RTS camera over cells ticking at frame rate — box-select, control groups, order queues flushed per tick. The DAW view owns the time axis: playhead, lanes, loops, quantize. FPS is where they meet: the render loop IS the tick loop (~200 ns/op → ~80k ops per 16 ms frame). Backend cells run headless in any IDE; VIEW is optional. Fleet evidence: `superinstance-live` (transport + CRDT sessions), `sketch-composite-headspace` (cognitive DAW, t-minus cueing, 51 tests), `tminus-music` (T-minus predictor), TWIST commensuration comb (physical quantize grid). Detail: `audit/fleet-toolchain-audit.md` §2. |

## Repo layout (Phase 0)

```
packages/quilt-core/
  src/reference-kernel.mjs      # the L1 contract in executable form (~110 lines)
  tests/kernel-contract.test.mjs # the interface spec: 28 tests, all green
audit/fleet-toolchain-audit.md   # what the fleet-midi family + LAU top-5 actually ship
```

Phase 0 = contracts + audit + decisions. The Theia shell generator lands in Phase 1
(`theia-app` skeleton with a quilt view contribution); it is deliberately deferred —
contracts first, furniture second.

## The kernel contract (summary)

- `bind(name, value)` — cell create/overwrite; name ≤256 chars, value JSON-only.
- `view(name)` — read; unknown → `null` (degrade, never throw).
- `link(a, b, type)` — typed directed edge; `UnknownCell` on unbound endpoints;
  idempotent per (a,b,type); stable id `a->b:type`.
- `effect(name, op, forward, inverse)` + `apply(name, op)` + `undo()` — reversible
  edits with LIFO history; empty undo → `false`.
- `tick(dt=1)` + `queueEffect(name, op)` — the clock; queued effects flush FIFO.
- `snapshot()` — `{cells, links, ts, historyDepth, queued}`, the Tide-Pool WRITE payload.

## Test

```bash
cd packages/quilt-core && node --test tests/kernel-contract.test.mjs
# 28/28 green
```

## License

EPL-2.0 (matching the Theia shell it will host).
