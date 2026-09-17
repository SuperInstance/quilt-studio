# quilt-view — the live view of the quilt cell graph

The skeleton promised an engine: "kernel subscription → render model →
frames." It lands here, tested on both substrates.

## Architecture

```
kernel (Contract v5 L2 events) → RenderModel → drain() frame diffs → CanvasRenderer
```

- **`src/render-model.mjs`** — headless, deterministic. Subscribes to the
  kernel, retains a scene (nodes + edges), and `drain()` returns the diff
  since the last call: `added / changed / removed / edgeAdded /
  edgeRemoved`, coalesced per node. Late attach syncs the current scene so
  a view born mid-stream still sees the set. Frames hand out fresh copies
  — aliasing is a bug, same as the kernel's own `view()`.
- **`src/canvas-renderer.mjs`** — thin browser skin (no DOM in tests).
  Abyssal palette, shared with twist-engine: nodes teal, links amber,
  changed cells flash for 900 ms. Array-of-points cells (the penfield
  orbit) draw as swarms.

## Laws pinned (tests/, 14 checks, both reference + WASM kernels)

1. bind→added, re-bind→changed, unbind→removed; drained frames are empty.
2. Links appear in scene and edge frames; unlink removes.
3. apply/undo fold back into node frames with post-op values.
4. tick advances model time; `load` re-syncs wholesale — new cells added,
   departed cells removed (the kernel store is replaced, so the scene is).
5. Aliasing: mutating a frame or scene never touches kernel state.
6. Late attach: constructor ingests the live scene as its first frame.
7. Floor integration: PenField steps re-arrive as `penfield.z` changes
   (whole swarm per step); the twist curve binds once and reads whole.
8. Same law, second substrate: every check runs on the reference kernel
   and the quilt-vm WASM adapter.

## Run the demo

```sh
cd packages/quilt-view && python3 -m http.server 8807
# → http://localhost:8807/examples/penfield-view.html
```

Left: the Penrose vertex stage. Right: the kernel scene — orbit swarm
advancing per beat, twist.curve + twist.live re-measuring R(θ) every
400 ms. Everything on the right is a `drain()` frame diff.

## Wiring

- CI: `.github/workflows/test.yml` job `quilt-view`.
- Boxes: `crabbox job run view-suite` — same command string as CI.
