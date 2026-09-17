// The phyllomandel field — Mandelbrot meets Fibonacci.
//
// Points seeded on a phyllotaxis spiral (golden angle 137.5077…°) sample the
// complex parameter plane; every kernel tick advances z → z² + c across the
// WHOLE field at once — one coherent iteration, one tick. Escape counts are
// read in Zeckendorf representation through the Fibonacci clock, so the
// field's arithmetic and the clock's arithmetic are the same arithmetic.
//
// Honest note: z → z² + c is not invertible (the sea does not run backward —
// inverse is a registered no-op; real reversal is the kernel's history/undo).
// The fractal shoreline essays knew this: the coastline is walked forward.

import { GOLDEN_ANGLE } from './address.mjs';
import { zeckendorf } from './golden.mjs';

export class Phyllomandel {
  constructor(kernel, { n = 60, center = [-0.75, 0], radius = 1.6 } = {}) {
    this.k = kernel;
    this.n = n;
    for (let i = 0; i < n; i++) {
      const r = radius * Math.sqrt(i), a = i * GOLDEN_ANGLE;
      const c = [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
      kernel.bind(`field.${i}`, { c, z: [0, 0], iter: 0, escaped: null });
      kernel.effect(`field.${i}`, 'step',
        v => stepOrbit(v),
        v => v); // documented no-op — irreversibility is the sea's nature
    }
  }

  // One coherent iteration across the entire field, driven by the kernel clock.
  stepAll() {
    for (let i = 0; i < this.n; i++) this.k.queueEffect(`field.${i}`, 'step');
    return this.k.tick(1);
  }

  cells() {
    const out = [];
    for (let i = 0; i < this.n; i++) out.push({ i, ...this.k.view(`field.${i}`) });
    return out;
  }

  escaped() { return this.cells().filter(c => c.escaped !== null); }

  // Zeckendorf terracing: iteration counts as sums of non-consecutive
  // Fibonacci numbers — the clock's handwriting on the field.
  terrace() {
    return this.cells().map(c => ({ i: c.i, iter: c.iter, zeck: zeckendorf(c.iter) }));
  }
}

function stepOrbit(v) {
  if (v.escaped !== null) return v;                    // the escaped stay escaped
  const [zx, zy] = v.z, [cx, cy] = v.c;
  const z2 = [zx * zx - zy * zy + cx, 2 * zx * zy + cy];
  const iter = v.iter + 1;
  const escaped = (z2[0] * z2[0] + z2[1] * z2[1]) > 4 ? iter : null;
  return { c: v.c, z: z2, iter, escaped };
}
