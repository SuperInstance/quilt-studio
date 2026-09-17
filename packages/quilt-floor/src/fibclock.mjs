// The Fibonacci clock — time that accumulates, never flows.
// (ai-writings/88-the-fibonacci-clock-keeps-odd-hours.md, made executable:
// "It doesn't flow. It accumulates. One, one, two, three, five.")
//
// The clock counts kernel ticks and displays each moment as the sum of its
// own history — the Zeckendorf representation: every n is a unique sum of
// non-consecutive Fibonacci numbers. Adjacency of indices is forbidden,
// exactly like adjacent short intervals on the floor. One law, two faces.

import { zeckendorf } from './golden.mjs';

export class FibClock {
  constructor(kernel) {
    this.k = kernel;
    this.k.bind('clock.n', 0, { what: 'accumulated ticks — the tab' });
    this.k.bind('clock.zeck', [], { what: 'Zeckendorf terms — how the evening nests' });
    this.k.bind('clock.words', 'zero', { what: 'the raconteur’s count' });
    // The effect transforms the value; the sibling binds are its voice.
    this.k.effect('clock.n', 'advance', v => {
      const n = (v ?? 0) + 1;
      this.k.bind('clock.zeck', zeckendorf(n));
      this.k.bind('clock.words', speak(n));
      return n;
    }, v => v);
  }

  // Tied to the kernel clock: queue + tick — one moment, one ts.
  advance() {
    this.k.queueEffect('clock.n', 'advance');
    return this.k.tick(1).applied[0]?.value;
  }

  now() { return { n: this.k.view('clock.n'), zeck: this.k.view('clock.zeck'), words: this.k.view('clock.words') }; }
}

const FNAME = { 2: 'one', 3: 'two', 4: 'three', 5: 'five', 6: 'eight', 7: 'thirteen', 8: 'twenty-one', 9: 'thirty-four', 10: 'fifty-five' };
function speak(n) {
  const terms = zeckendorf(n);
  if (!terms.length) return 'zero';
  // 4 → 'three-one', 7 → 'five-two': the odd hours, kept.
  return terms.map(k => FNAME[k] ?? `F${k}`).join('-');
}
