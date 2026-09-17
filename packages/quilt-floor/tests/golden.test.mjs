// The golden mathematics, pinned. Pure module — no kernel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHI, fibNum, word, wordCounts, lengthRatio, zeckendorf, zeckSum, zeckShift, convergentGaps } from '../src/golden.mjs';

const EPS = 1e-9;

test('φ is the number that refuses to settle', () => {
  assert.ok(Math.abs(PHI - 1.618033988749895) < EPS);
  assert.ok(Math.abs(PHI * PHI - PHI - 1) < EPS, 'φ² = φ + 1');
  assert.ok(Math.abs(1 / PHI - (PHI - 1)) < EPS, '1/φ = φ − 1');
});

test('Fibonacci word: substitution A→AB, B→A, lengths follow F', () => {
  assert.equal(word(0), 'A');
  assert.equal(word(1), 'AB');
  assert.equal(word(2), 'ABA');
  assert.equal(word(3), 'ABAAB');
  assert.equal(word(4), 'ABAABABA');
  for (let g = 0; g <= 10; g++) assert.equal(word(g).length, fibNum(g + 2));
});

test('the substitution matrix [[1,1],[1,0]] has eigenvalues φ and −1/φ', () => {
  // Counts converge to the matrix's action: (A,B)_{g+1} = (A+B, A).
  // The −1/φ eigenvalue alternates the sign of the error while it decays —
  // the ratio approaches φ in a tightening zigzag, never settling directly.
  const r = lengthRatio(20);
  assert.ok(Math.abs(r - PHI) < 1e-4, `ratio ${r} ≈ φ`);
  let prev = lengthRatio(2) - PHI;
  for (let g = 3; g <= 20; g++) {
    const err = lengthRatio(g) - PHI;
    assert.ok(Math.sign(err) === -Math.sign(prev), `gen ${g}: error alternates sign`);
    assert.ok(Math.abs(err) < Math.abs(prev) * 0.7, `gen ${g}: |−1/φ| ≈ 0.618 decay`);
    prev = err;
  }
});

test('the word forbids BB and AAA — the matching rules of the line', () => {
  for (let g = 0; g <= 12; g++) {
    const w = word(g);
    assert.ok(!w.includes('BB'), `gen ${g}: no BB`);
    assert.ok(!w.includes('AAA'), `gen ${g}: no AAA`);
  }
});

test('Zeckendorf: unique sums of non-consecutive Fibonacci numbers', () => {
  const seen = new Set();
  for (let n = 0; n < 2000; n++) {
    const terms = zeckendorf(n);
    for (let i = 0; i + 1 < terms.length; i++)
      assert.ok(terms[i] - terms[i + 1] >= 2, `n=${n}: no adjacent indices`);
    assert.equal(zeckSum(terms), n, `n=${n}: sum round-trips`);
    const key = terms.join(',');
    assert.ok(!seen.has(key), `n=${n}: representation is unique`);
    seen.add(key);
  }
});

test('the Zeckendorf shift identity — the window becomes exact', () => {
  // floor(a·φ) = Σ F(k+1) − ε, ε=1 iff the least Zeckendorf index is even.
  // Probed case-by-case (a=2 breaks the naive −1), pinned to 3000 here.
  for (let a = 0; a < 3000; a++) assert.equal(Math.floor(a * PHI), zeckShift(a), `a=${a}`);
  // the strip's acceptance criterion falls out: {aφ} > 1/φ²
  const invPhi2 = 1 / (PHI * PHI);
  for (let a = 1; a < 3000; a++) {
    const frac = a * PHI - Math.floor(a * PHI);
    const b = Math.ceil(a * PHI - 1e-12);            // the strip's candidate b
    const stripAccepts = (b - a * PHI) < 1 / PHI - 1e-9;
    assert.equal(frac > invPhi2, stripAccepts, `a=${a}: window ⇔ Zeckendorf threshold`);
  }
});

test('the commensuration ladder: convergent gaps of the golden direction', () => {
  // F(n+1)/F(n) · 360° overshoots/undershoots 360φ; the gaps ARE the teeth
  // TWIST's instrument resolves — a sub-degree ladder above F₉/F₈.
  const gaps = convergentGaps(14);
  const abs = gaps.map(g => ({ n: g.n, abs: Math.abs(g.degrees) }));
  const ladder = abs.filter(g => g.n >= 8); // F₉/F₈ onward: all under 0.4°
  for (const g of ladder) assert.ok(g.abs < 0.4, `F${g.n + 1}/F${g.n} gap ${g.abs}° < 0.4°`);
  for (let i = 1; i < ladder.length; i++)
    assert.ok(ladder[i].abs < ladder[i - 1].abs, 'the comb closes on φ');
  // the classic seven-tooth window: seven consecutive rungs under half a degree
  const seven = abs.filter(g => g.abs < 0.5).slice(0, 7);
  assert.deepEqual(seven.map(g => g.n), [8, 9, 10, 11, 12, 13, 14], 'seven teeth, F₉/F₈ … F₁₅/F₁₄');
});
