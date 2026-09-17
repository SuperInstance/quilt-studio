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

  // One generation: repartition every live interval. The golden cut keeps
  // kind lengths UNIFORM across lineages (the strip test caught the naive
  // uniform-scaling version drifting into lineage-dependent lengths):
  //   A (len α)   → A(α/φ) + B(α/φ²)      cover: α(1/φ + 1/φ²) = α
  //   B (len α/φ) → A(α/φ)                cover: identity — the B grows
  //                                         into the new A, unscathed
  deflate() {
    const live = this.intervals();
    const scale = 1 / PHI;
    const children = [];
    for (const t of live) {
      if (t.kind === 'A') {
        children.push({ parent: t.name, ord: 0, kind: 'A', x0: t.x0, len: t.len * scale });
        children.push({ parent: t.name, ord: 1, kind: 'B', x0: t.x0 + t.len * scale, len: t.len * scale * scale });
      } else {
        children.push({ parent: t.name, ord: 0, kind: 'A', x0: t.x0, len: t.len });
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

  // Reflation, v2 (playtest finding): explicit rebind, NOT global undo.
  // The undo-stack version rewound ANY tenant's history it found interleaved
  // (a FibClock lost ticks and kept its ts — inconsistent), and its 1e6-undo
  // guard silently aborted deep refolds. Instead: unbind the live names past
  // the target, rebind the target generation at its exact coordinates via
  // the pure plan. Cost is honestly O(tiles rebalanced); foreign tenants
  // are untouched; kernel history only GROWS. Rewind the floor with
  // floor.reflate, never with kernel.undo — undo is one step, reflate is
  // geology.
  reflate(gens = 1) {
    const target = Math.max(0, this.gen - gens);
    if (target === this.gen) return { gen: this.gen, rebalanced: 0 };
    const plan = FibFloor.plan(target);
    const keep = new Set(plan.map(t => t.name));
    let unbound = 0;
    // unbind every live hierarchical name the target generation does not
    // use — unbind's edge sweep also retires their 'next' links
    for (const t of FibFloor.plan(this.gen))
      if (!keep.has(t.name)) { this.k.unbind(t.name); unbound++; }
    // re-stamp the target generation's names at their exact coordinates
    // (same value shape deflate writes, so regrowth is bit-identical)
    for (const t of plan)
      this.k.bind(t.name, { kind: t.kind, x0: t.x0, len: t.len, gen: target }, { index: t.index, ...addressOf(t.index) });
    this.k.bind('floor.gen', target);
    this.gen = target;
    return { gen: this.gen, rebalanced: unbound };
  }

  // Pure forward plan at generation g — the exact tile layout deflate()
  // produces, without touching a kernel. Reflation replays it; tests diff
  // against it. Names are HIERARCHICAL (tile 3's first child is floor.3.0),
  // stamped with the same {kind,x0,len,gen} value shape and the same
  // post-sort address index deflate assigns. Bitwise parity is the point:
  // a refolded floor must regrow identically to one that never moved.
  static plan(gen) {
    const scale = 1 / PHI;
    let tiles = [{ name: 'floor.0', kind: 'A', x0: 0, len: 1, gen: 0, index: 0 }];
    for (let g = 1; g <= gen; g++) {
      const next = [];
      for (const t of tiles) {
        if (t.kind === 'A') {
          next.push({ name: `${t.name}.0`, kind: 'A', x0: t.x0, len: t.len * scale, gen: g });
          next.push({ name: `${t.name}.1`, kind: 'B', x0: t.x0 + t.len * scale, len: t.len * scale * scale, gen: g });
        } else {
          next.push({ name: `${t.name}.0`, kind: 'A', x0: t.x0, len: t.len, gen: g });
        }
      }
      next.sort((a, b) => a.x0 - b.x0);      // live order = index, as deflate()
      next.forEach((t, i) => { t.index = i; });
      tiles = next;
    }
    return tiles;
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
