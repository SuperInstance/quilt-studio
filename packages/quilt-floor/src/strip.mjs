// The Strip — the cut-and-project floor. The same word the FibFloor grows
// by substitution, reached here by PROJECTION: select lattice points, don't
// subdivide tiles. Two roads, one floor — the polyformalism dot, pinned by
// the affine-identity test against FibFloor.
//
// Construction (constants pinned empirically — see tests/strip.test.mjs;
// nothing below is trusted from memory):
//   e_par  = (1, φ)/SQ        the golden line, unit
//   e_perp = (−φ, 1)/SQ       the perpendicular
//   For each integer column a, accept lattice points whose perp offset
//   b − φ·a falls in the window [w0·SQ, w0·SQ + width)  (width in b-units).
//   Project accepted points onto e_par; the spacings of the sorted
//   projection take exactly TWO values, long and short, in ratio φ, and
//   their order IS the Fibonacci word.
//
// Empirical results that became contract:
//   - width = 1/φ (also 1 and φ — the three self-similar windows):
//     2 distinct spacings, L/S = φ to 1e-12, pattern == word, no BB/AAA.
//   - other widths: ratio φ² = 2.618, pattern is a different Sturmian
//     sequence — near-misses, not the floor. The window is the instrument's
//     tuning; only the golden widths sing the word.
//   - The B-frequency converges to 1/φ² — the essay's "number that refuses
//     to settle" is also the frequency that does.
//
// Phase convention: with w0 = 0 the sequence begins one symbol before the
// word's seed A — layout() therefore exposes the raw pattern, and the word
// reads from index 1 (asserted in tests). That leading B is the westward
// witness: the floor has a past.

import { PHI, word as expectedWord } from './golden.mjs';
import { addressOf } from './address.mjs';

const SQ = Math.sqrt(PHI * PHI + 1);
// The three golden windows (b-units). 1/φ is canonical; 1 and φ give the
// same tiling rescaled — self-similarity of the golden mean shift, tested.
export const GOLDEN_WINDOWS = [1 / PHI, 1, PHI];

export class Strip {
  constructor(kernel, { m = 512, width = 1 / PHI, w0 = 0 } = {}) {
    this.k = kernel;
    this.m = m;
    this.width = width;
    this.w0 = w0;
    this.k.bind('strip.m', m, { what: 'lattice reach — one number, not a generation' });
    this.k.bind('strip.width', width, { what: 'perpendicular window in b-units; the tuning' });
    this._build();
  }

  _build() {
    const pts = [];
    const lo0 = this.w0 * SQ, span = this.width;
    for (let a = 0; a < this.m; a++) {
      const lo = PHI * a + lo0;
      const hi = lo + span;
      for (let b = Math.ceil(lo - 1e-12); b < hi - 1e-12; b++) {
        pts.push({
          a, b,
          par: (a + PHI * b) / SQ,
          perp: (-PHI * a + b) / SQ,
        });
      }
    }
    pts.sort((p, q) => p.par - q.par);
    const L = pts.length;
    this.k.bind('strip.n', Math.max(0, L - 1), { what: 'intervals = projected points − 1' });
    for (let i = 0; i + 1 < L; i++) {
      const len = pts[i + 1].par - pts[i].par;
      // kind is null until the two-spacings classification pass below.
      this.k.bind(`strip.${i}`, { a: pts[i].a, b: pts[i].b, par: pts[i].par, perp: pts[i].perp, kind: null, len }, { index: i, ...addressOf(i) });
    }
    // Second pass: classify with the mid-threshold of the two-spacings law.
    if (L > 2) {
      const lens = [];
      for (let i = 0; i + 1 < L; i++) lens.push(this.k.view(`strip.${i}`).len);
      const max = Math.max(...lens), min = Math.min(...lens), t = (max + min) / 2;
      for (let i = 0; i + 1 < L; i++) {
        const v = this.k.view(`strip.${i}`);
        this.k.bind(`strip.${i}`, { ...v, kind: v.len > t ? 'A' : 'B' }, { index: i, ...addressOf(i) });
      }
      for (let i = 0; i + 2 < L; i++)
        this.k.link(`strip.${i}`, `strip.${i + 1}`, 'next');
    }
  }

  // Live intervals eastward. Note: unlike FibFloor there is no generation —
  // the strip is one fixed bi-infinite sequence read through a window of
  // reach m. Growing m reveals more of the SAME sequence (prefix stability,
  // tested) — self-similarity without substitution, the fractal essays'
  // claim in another voice.
  intervals() {
    const n = this.k.view('strip.n') ?? 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = this.k.view(`strip.${i}`);
      if (v) out.push({ name: `strip.${i}`, ...v });
    }
    return out;
  }

  layout() {
    return this.intervals().map(t => t.kind).join('');
  }

  // The word from index 1 — the phase convention, see header.
  word() {
    return this.layout().slice(1);
  }
}

export { SQ, expectedWord };
