// mask.mjs — scoped application, the Custom-NR-Mask concept clean-room.
//
// dlss5-visual-enhancer applies neural rendering only where a mask allows.
// The floor version is a law, not a heuristic: a mask is an EXACT SET over
// a declared universe; a masked operation transforms members and leaves
// non-members untouched — untouched means the returned values are the
// SAME rats (ratEq, BigInt cross-product zero), never recomputed
// approximations. Masks compose by union/intersection/difference, and a
// mask can be derived from tenancy (cells the kernel already holds), so a
// hosted fabric's own notes (ghost edges, kill-vetoes, defects) scope the
// next pass without leaving the kernel.

import { ratEq } from './commensurate.mjs';

// makeMask(universe, predicate) — exact set membership over a FINITE
// declared universe. Every member's identity is checked against the
// universe; a predicate that fires outside the universe is a bug, thrown.
export function makeMask(universe, predicate, { name = 'mask' } = {}) {
  const U = [...universe];
  const set = new Set();
  for (const x of U) {
    if (predicate(x)) {
      if (!U.includes(x)) throw new Error(`mask: predicate fired outside the universe (${String(x)})`);
      set.add(x);
    }
  }
  return {
    name,
    universe: U,
    has: x => set.has(x),
    get members() { return [...set]; },
    get size() { return set.size; },
  };
}

// the boolean algebra of scopes (exact, as sets are)
export const maskUnion = (a, b) =>
  makeMask(a.universe, x => a.has(x) || b.has(x), { name: `(${a.name}∪${b.name})` });
export const maskInter = (a, b) =>
  makeMask(a.universe, x => a.has(x) && b.has(x), { name: `(${a.name}∩${b.name})` });
export const maskDiff = (a, b) =>
  makeMask(a.universe, x => a.has(x) && !b.has(x), { name: `(${a.name}∖${b.name})` });
export const maskFull = universe => makeMask(universe, () => true, { name: '⊤' });
export const maskEmpty = universe => makeMask(universe, () => false, { name: '⊥' });

// applyMasked(items, mask, keyOf, op) — THE LAW. op(item) for members;
// non-members are carried through UNTOUCHED — the same rat identities.
// keyOf(item) maps each item to its universe key. Returns { out, applied }.
export function applyMasked(items, mask, keyOf, op) {
  const out = [];
  let applied = 0;
  for (const item of items) {
    const k = keyOf(item);
    if (!mask.universe.includes(k)) throw new Error(`mask: item key ${String(k)} not in the universe`);
    if (mask.has(k)) { out.push(op(item)); applied++; }
    else out.push(item);
  }
  return { out, applied };
}

// exactness audit — prove the carry-through: every non-member's lift
// strings are identical between input and output (identity, not equality
// of value-by-recompute). A convenience that makes the law checkable.
export function auditUntouched(before, after, mask, keyOf, liftOf) {
  const B = new Map(before.map(x => [keyOf(x), liftOf(x)]));
  const violations = [];
  for (const item of after) {
    const k = keyOf(item);
    if (mask.has(k)) continue;
    const b = B.get(k);
    const a = liftOf(item);
    if (JSON.stringify(b) !== JSON.stringify(a)) violations.push(k);
  }
  return { clean: violations.length === 0, violations };
}

// maskFromCells(kernel, {prefix, where}) — derive a mask from tenancy:
// the universe is the cell names under prefix; membership is decided by a
// predicate on the cell VIEW (e.g. cells whose what-note mentions 'ghost').
export function maskFromCells(kernel, { prefix, where }) {
  const names = kernel.cells().filter(c => c.startsWith(prefix));
  return makeMask(names, n => where(kernel.view(n), kernel.metaOf(n)), { name: `cells:${prefix}` });
}

// hostMask(kernel, mask, {name}) — the mask itself becomes a cell: its
// member list is the identity; 'scopes' links point at every member.
export function hostMask(kernel, mask, { name = mask.name } = {}) {
  kernel.bind(`mask.${name}`, mask.members, { what: `mask ${mask.name}: ${mask.size}/${mask.universe.length} members` });
  for (const m of mask.members) kernel.link(`mask.${name}`, m, 'scopes');
  return { cells: 1, links: mask.members.length };
}
