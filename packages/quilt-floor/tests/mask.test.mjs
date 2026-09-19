// mask.mjs — scoped-application laws. Membership is exact set semantics;
// carry-through is ratEq identity, audited, never assumed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { makeRat, ratEq, ratToString } from '../src/commensurate.mjs';
import { liftQ15, liftQ15Vector, makeTraj, velocity } from '../src/q16.mjs';
import { makeMask, maskUnion, maskInter, maskDiff, maskFull, maskEmpty, applyMasked, auditUntouched, maskFromCells, hostMask } from '../src/mask.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

// three ℚ¹⁶ states; dial 0 is the "tone" dial, 1..15 structural
const states = () => {
  const a = liftQ15Vector(Array(16).fill(0));
  const b = liftQ15Vector(Array(16).fill(64));
  const c = liftQ15Vector(Array(16).fill(128));
  return makeTraj([a, b, c]);
};

test('makeMask: exact membership over a declared universe; algebra composes', () => {
  const U = ['x', 'y', 'z'];
  const m = makeMask(U, v => v !== 'y');
  assert.deepEqual(m.members.sort(), ['x', 'z']);
  assert.equal(m.has('y'), false);
  assert.equal(m.size, 2);
  const full = maskFull(U), empty = maskEmpty(U);
  assert.equal(full.size, 3);
  assert.equal(empty.size, 0);
  assert.deepEqual(maskUnion(m, makeMask(U, v => v === 'y')).members.sort(), U);
  assert.deepEqual(maskInter(m, makeMask(U, v => v === 'z')).members, ['z']);
  assert.deepEqual(maskDiff(full, m).members, ['y']);
});

test('applyMasked: members transform, non-members are the SAME rats (identity, not recompute)', () => {
  const traj = states();
  const legs = [velocity(traj, 1), velocity(traj, 2)]; // the "mutations" to apply
  const items = legs.map((v, i) => ({ key: `leg${i}`, vec: v }));
  const passAll = maskFull(items.map(x => x.key));
  const doubled = applyMasked(items, passAll, x => x.key, x => ({ key: x.key, vec: x.vec.map(r => ratEq(r, makeRat(0n)) ? r : makeRat(r.num * 2n, r.den)) }));
  assert.equal(doubled.applied, 2);
  assert.ok(doubled.out[0].vec.every((r, i) => ratEq(r, items[0].vec[i]) || ratEq(r, makeRat(items[0].vec[i].num * 2n, items[0].vec[i].den))));
  // empty mask = total carry-through, zero applications
  const none = applyMasked(items, maskEmpty(items.map(x => x.key)), x => x.key, x => ({ key: 'MUTATED', vec: x.vec }));
  assert.equal(none.applied, 0);
  assert.ok(none.out.every((x, i) => x === items[i]), 'carried through by reference identity');
});

test('auditUntouched: proves the carry-through on lift strings; catches a violation', () => {
  const traj = states();
  const legs = [velocity(traj, 1), velocity(traj, 2)].map((v, i) => ({ key: `leg${i}`, vec: v }));
  const onlyFirst = makeMask(legs.map(x => x.key), k => k === 'leg0');
  const { out } = applyMasked(legs, onlyFirst, x => x.key,
    x => ({ key: x.key, vec: x.vec.map(r => makeRat(r.num + 1n, r.den)) }));
  const audit = auditUntouched(legs, out, onlyFirst, x => x.key, x => x.vec.map(ratToString));
  assert.equal(audit.clean, true, 'leg1 untouched: identical lift strings');
  // fabricate a violation: REPLACE a non-member with a mutated clone
  // (mutating in place would hit the same object — carry-through is by
  // reference, which is the very law being audited)
  out[1] = { key: 'leg1', vec: out[1].vec.map(r => makeRat(r.num + 7n, r.den)) };
  const caught = auditUntouched(legs, out, onlyFirst, x => x.key, x => x.vec.map(ratToString));
  assert.deepEqual(caught.violations, ['leg1'], 'the audit catches scope leaks');
});

for (const [label, K] of kernels) {
  test(`${label}: masks derive from tenancy and host back — ghosts scope the next pass`, () => {
    const k = new K();
    // host a mini fabric: three arcs, one flagged ghost in its note
    k.bind('fabric.a→b', { length: 1.0 }, { what: 'arc a→b' });
    k.bind('fabric.b→c', { length: 2.0 }, { what: 'arc b→c — GHOST edge (pending catalog PR #19)' });
    k.bind('fabric.c→a', { length: 1.5 }, { what: 'arc c→a' });
    for (const n of ['fabric.a→b', 'fabric.b→c', 'fabric.c→a']) k.bind(n.replace('fabric.', 'node.'), { name: n }, {});
    const ghosts = maskFromCells(k, { prefix: 'fabric.', where: (view, meta) => /GHOST/.test(meta.what) });
    assert.deepEqual(ghosts.members, ['fabric.b→c'], 'the mask is derived from hosted state, not re-declared');
    // the repair pass applies ONLY to the ghost — scoped by tenancy
    const { out, applied } = applyMasked(
      ghosts.universe.map(n => ({ key: n, note: k.metaOf(n).what })),
      ghosts, x => x.key,
      x => ({ key: x.key, note: x.note + ' → scheduled for catalog repair' }));
    assert.equal(applied, 1);
    assert.match(out.find(x => x.key === 'fabric.b→c').note, /repair/);
    assert.doesNotMatch(out.find(x => x.key === 'fabric.a→b').note, /repair/);
    // host the mask itself: membership is the identity
    const { cells, links } = hostMask(k, ghosts, { name: 'ghosts' });
    assert.equal(cells, 1);
    assert.equal(links, 1);
    assert.equal(k.view('mask.ghosts')[0], 'fabric.b→c');
    assert.equal(k.links().find(l => l.type === 'scopes').to, 'fabric.b→c');
  });
}

test('anti-vacuity: the full mask applies everywhere, the empty mask is the identity law', () => {
  const U = [1, 2, 3];
  const items = U.map(i => ({ key: i, v: makeRat(BigInt(i)) }));
  const full = applyMasked(items, maskFull(U), x => x.key, x => ({ key: x.key, v: makeRat(99n) }));
  assert.ok(full.out.every(x => x.v.num === 99n), 'full mask: everything transformed');
  const empty = applyMasked(items, maskEmpty(U), x => x.key, x => ({ key: x.key, v: makeRat(99n) }));
  assert.ok(empty.out.every((x, i) => x.v === items[i].v), 'empty mask: rat identity, zero transformations');
});
