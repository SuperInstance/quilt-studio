// The Fibonacci floor — a one-dimensional Penrose floor, exact.
//
// Essay made executable (ai-writings/51-the-penrose-floor.md):
//   Intervals tile the line. Long (A) has length 1, short (B) has length
//   1/φ — ratio φ, the number that refuses to settle. Layout at generation g
//   is the Fibonacci word σ^g(A), σ: A→AB, B→A. Deflation subdivides every
//   tile by exactly φ (children cover the parent — the floor is always
//   perfectly tiled). Substitution counts follow [[1,1],[1,0]], eigenvalues
//   φ and −1/φ.
//
// On the kernel:
//   - one generation = kernel tick. The kernel's clock IS the floor's
//     generational clock.
//   - SEDIMENTARY TIME: generations never delete. Parents stay bound at
//     their generation; children take hierarchical names (tile 3's children
//     are 3.0, 3.1). Live tiles = cells whose gen equals floor.gen. The
//     lineage is visible in the cell graph — "the floor does not forget
//     because the floor does not store. The floor IS."
//   - Reflation = undo the gen-bind: time travel is O(gens). Re-deflation
//     overwrites sediment deterministically — the floor regrows identically,
//     because its history IS its future.
//   - Adjacency edges ('next') are matching rules: BB and AAA never occur on
//     the floor at any generation — the Fibonacci word's forbidden patterns,
//     tested.
//   - Every live interval carries its phyllotaxis address as cell metadata:
//     the position IS the cell, at a coarser resolution.

import { PHI, word, word as expectedWord } from './golden.mjs';
import { addressOf } from './address.mjs';

const SHORT = 1 / PHI;

export class FibFloor {
  constructor(kernel) {
    this.k = kernel;
    this.gen = 0;
    this.k.bind('floor.gen', 0, { what: 'generational clock — one tick per deflation' });
    // The seed: a single long interval. Day one.
    this._place('floor.0', 'A', 0, 1, 0, 0);
  }

  _place(name, kind, x0, len, gen, index) {
    this.k.bind(name, { kind, x0, len, gen }, { index, ...addressOf(index) });
  }

  // Live intervals at the current generation, west to east.
  intervals() {
    return this.k.cells('floor.')
      .filter(n => n !== 'floor.gen')
      .map(n => ({ name: n, ...this.k.view(n) }))
      .filter(t => t.gen === this.gen)
      .sort((a, b) => a.x0 - b.x0);
  }

  layout() {
    return this.intervals().map(t => t.kind).join('');
  }

  count() { return this.intervals().length; }

  // One generation: subdivide every live interval. Lengths ×1/φ, exact cover:
  //   A (len 1)    → A(1/φ) + B(1/φ²)   total 1
  //   B (len 1/φ)  → A(1/φ)             total 1/φ
  deflate() {
    const live = this.intervals();
    const scale = 1 / PHI;
    const children = [];
    for (const t of live) {
      if (t.kind === 'A') {
        children.push({ parent: t.name, ord: 0, kind: 'A', x0: t.x0, len: t.len * scale });
        children.push({ parent: t.name, ord: 1, kind: 'B', x0: t.x0 + t.len * scale, len: t.len * scale * scale });
      } else {
        children.push({ parent: t.name, ord: 0, kind: 'A', x0: t.x0, len: t.len * scale });
      }
    }
    children.sort((a, b) => a.x0 - b.x0); // live order = index
    children.forEach((c, i) => this._place(`${c.parent}.${c.ord}`, c.kind, c.x0, c.len, this.gen + 1, i));
    for (let i = 0; i + 1 < children.length; i++)
      this.k.link(`${children[i].parent}.${children[i].ord}`, `${children[i + 1].parent}.${children[i + 1].ord}`, 'next');
    this.gen += 1;
    this.k.bind('floor.gen', this.gen);
    this.k.tick(1); // the generational clock advances with the floor
    return { gen: this.gen, count: children.length };
  }

  // Time travel: undo the gen-binds. Each generation ends with exactly one
  // bind of floor.gen, so reflate(gens) costs O(gens) undos. Deterministic
  // in both directions: re-deflating overwrites sediment with the same values.
  reflate(gens = 1) {
    const target = Math.max(0, this.gen - gens);
    let undos = 0;
    // undo(): restored value | null (fresh bind removed) | undefined (empty).
    // Only undefined means "stop" — null is a normal step (sediment removed).
    while ((this.k.view('floor.gen') ?? 0) > target) {
      const r = this.k.undo();
      if (r === undefined || ++undos > 1e6) break;
    }
    this.gen = this.k.view('floor.gen') ?? 0;
    return { gen: this.gen, undos };
  }

  // The golden-direction walk (the essay's recall): start at the i-th live
  // interval, compose the addresses of the next `steps` intervals. The
  // aggregate is the answer; the walk is the inference.
  walk(i, steps) {
    const live = this.intervals();
    const visited = live.slice(i, i + steps).map(t => {
      const meta = this.k.metaOf(t.name);
      return { ...t, address: { x: meta.x, y: meta.y } };
    });
    const aggregate = visited.reduce((a, t) => ({ x: a.x + t.address.x, y: a.y + t.address.y }), { x: 0, y: 0 });
    return { visited, aggregate };
  }
}

export { expectedWord, PHI, SHORT };
