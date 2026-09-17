// The Comb — TWIST's commensuration instrument as a live kernel tenant.
// The ladder from golden.convergentGaps is not a printed table; it is a
// cell that recomputes as the reach extends. A view engine subscribes
// (L2 surface) and draws the teeth as they sharpen — "the comb sings."
//
// Dot connection: Twist measures the golden direction's Diophantine gaps;
// the floor walks the same direction. Instrument and floor are one
// mathematics, two voices (docs/THE-FLOOR.md §4).

import { convergentGaps, PHI } from './golden.mjs';

export class Comb {
  constructor(kernel) {
    this.k = kernel;
    this.k.bind('comb.n', 8, { what: 'reach — how far up the Fibonacci ladder we listen' });
    this.k.bind('comb.teeth', [], { what: 'the ladder, computed' });
    this.k.effect('comb.n', 'extend', v => {
      const n = (v ?? 8) + 1;
      const teeth = convergentGaps(n).map(t => ({
        n: t.n,
        degrees: t.degrees,
        abs: Math.abs(t.degrees),
        belowHalfDegree: Math.abs(t.degrees) < 0.5,
      }));
      this.k.bind('comb.teeth', teeth);
      return n;
    }, v => v);
    this.k.apply('comb.n', 'extend'); // prime the table at n=9
  }

  // Tied to the kernel clock, like every floor instrument.
  extend() {
    this.k.queueEffect('comb.n', 'extend');
    return this.k.tick(1).applied[0]?.value;
  }

  teeth() { return this.k.view('comb.teeth'); }

  // How many teeth resolve under half a degree — the instrument's precision.
  resolution() {
    return this.teeth().filter(t => t.belowHalfDegree).length;
  }
}

export { PHI };
