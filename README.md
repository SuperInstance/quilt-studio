# quilt-studio

**An open-source studio built on the polyformalism.** Theia product shell around a
quilt-vm kernel, t-minus transport, the fleet-midi toolchain, and the Tide-Pool memory.

**What that means in one paragraph:** a *cell* is a named JSON value; *cells* are
wired into a typed graph; **BIND / LINK / EFFECT / VIEW / TICK** are the only five
things the runtime can do to them. The same graph is simultaneously a program, a
memory, a session file, and a live stage — the studio is the camera pointed at it.
One WASM kernel, many faces (Theia shell, web, CLI, game engine, TouchDesigner).
Music studios are the model: the quilt is the session; every cell is an instrument
or a cable.

Full thesis: `SuperInstance` workspace → `design/2026-09-17-quilt-studio-thesis.md`
(the decisions below are committed there as §9–11).

**New here? Start at `packages/quilt-core/`** — the 28-test contract any kernel must
pass, two implementations that do (pure JS reference + the real quilt-vm-wasm WASM
build, vendored — no Rust toolchain needed), and `audit/fleet-toolchain-audit.md`
for the full map of what the fleet's music/DAW/MIDI projects ship today.

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
  src/reference-kernel.mjs       # the L1 contract in executable form (~110 lines)
  src/wasm-kernel.mjs            # L1 adapter over the REAL quilt-vm-wasm WASM exports
  vendor/quilt_vm_wasm.cjs       # wasm-bindgen glue (nodejs target, renamed .cjs)
  vendor/quilt_vm_wasm_bg.wasm   # vendored kernel build (131 KB, regenerate via scripts/build-kernel.sh)
  tests/contract-suite.mjs       # THE interface spec: 28 tests, kernel-agnostic
  tests/kernel-contract.test.mjs # suite → reference JS kernel
  tests/wasm-kernel.test.mjs     # suite → real WASM kernel (the gate that matters)
  scripts/build-kernel.sh        # regenerate vendor/ from SuperInstance/quilt-vm-wasm
audit/fleet-toolchain-audit.md   # what the fleet-midi/DAW family + LAU top-5 actually ship
```

**Phase 0 status: the WASM kernel is in the chair.** Both kernels pass the same
39-test contract — 78/78 total (`npm test` in `packages/quilt-core`). Upstream fixes
required to get here: PR SuperInstance/quilt-vm-wasm#1 (unbuildable manifest +
`time()` scalar getter). Adapter-owned semantics and upstream gaps: see the audit.

## The kernel contract (summary)

Ten-line tour: `node examples/hello-quilt.mjs`. Executable spec:
`packages/quilt-core/tests/contract-suite.mjs` (39 tests, kernel-agnostic).

- `bind(name, value)` — cell create/overwrite; name ≤256 chars; value is JSON-canonical
  (snapshotted — mutating the original doesn't alias; NaN/±Infinity → null).
- `view(name)` — read; unknown → `null` (degrade, never throw).
- `link(a, b, type)` — typed directed edge; `UnknownCell` on unbound endpoints;
  idempotent per (a,b,type); stable id `a->b:type` with separator escaping (weird
  names can't collide).
- `unlink(id)` / `unbind(name)` — deletion; degrade to `false` on unknown.
- `effect(name, op, forward, inverse)` — register a declared-bidirectional op.
- `apply` / `applyInverse` — run forward / inverse; `undo()` is global LIFO and
  returns the restored value (`null` when empty).
- `queueEffect(name, op)` — validated at enqueue (bad cell/op throws immediately).
- `tick(dt=1)` / `now()` — the DAW clock; queued effects flush FIFO per tick.
- `snapshot()` / `load(snapshot)` — distillable state / hydrate (clock restarts at 0:
  `ts` is provenance, and the WASM substrate has no time-setter).

**L2 surface (contract v3, playtest-driven):**
- `subscribe(fn, {cell?, kinds?}) -> unsub` — the kernel reports every mutation;
  render models listen, they don't poll.
- `viewMany(names)` / `cells(prefix?)` — batch reads for 60fps views.
- `bind(name, value, meta?)` / `metaOf(name)` — cell metadata (units/min/max);
  meta rides along in `snapshot().meta` and survives `load()`.
- `view()` always returns a fresh copy — mutating a view result can never touch
  kernel state.

**Playtest loop:** outside-subagent playtests audit each contract revision; findings
fold back into the next (see `git log` — the commits say what each round found).

## Test

```bash
cd packages/quilt-core && npm test
# 78/78 green — the same 39-test contract over BOTH the reference JS kernel
# and the real quilt-vm-wasm WASM kernel.
```

## License

EPL-2.0 (matching the Theia shell it will host).
