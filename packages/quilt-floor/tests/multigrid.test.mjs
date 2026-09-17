// The multigrid over BOTH kernels — the iceberg: the 2D crystal whose every
// direction hides the 1D Fibonacci floor. Same discipline as every floor
// instrument: constants pinned empirically first (probes in /tmp/probe-mg*),
// locked here; anti-vacuity tests prove the passing tests mean something.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Multigrid, goldenGaps } from '../src/multigrid.mjs';
import { PHI } from '../src/golden.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];   // no rational relations: proper Penrose
const SINGULAR = [0, 0, 0, 0, 0];            // triple concurrences: the singular case
const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

// Reproduce the probe's line-map: family-k dual edge-lines with the radius
// of their innermost generating arrangement segment.
function edgeLines(m, k) {
  const n = m.normals[k];
  const perp = [-n[1], n[0]];
  const map = new Map();
  for (const s of m.arrangementSegments()) {
    if (s.k !== k) continue;
    const a = [(s.j + m.gamma[k]) * m.normals[k][0], (s.j + m.gamma[k]) * m.normals[k][1]];
    const tm = (s.t1 + s.t2) / 2;
    const mx = a[0] + tm * perp[0], my = a[1] + tm * perp[1];
    for (const f of [s.above, s.below]) {
      let cx = 0, cy = 0;
      for (let i = 0; i < m.N; i++) { const w = f[i] + m.gamma[i] + 0.5; cx += w * m.normals[i][0]; cy += w * m.normals[i][1]; }
      cx *= 2 / m.N; cy *= 2 / m.N;
      const c = perp[0] * cx + perp[1] * cy;
      const key = Math.round(c * 1e9);
      const e = map.get(key) ?? { c, midR: Infinity };
      e.midR = Math.min(e.midR, Math.hypot(mx, my));
      map.set(key, e);
    }
  }
  return [...map.values()].sort((x, y) => x.c - y.c);
}

test('generic γ: the dual is exactly Penrose P3 — all edges length 2/5, five normal directions', () => {
  const m = new Multigrid({ N: 5, gamma: GENERIC, reach: 4 });
  const { faces, edges } = m.dualEdges();
  assert.ok(faces.length > 500 && edges.length > 500);
  for (const e of edges) {
    const a = faces[e.a], b = faces[e.b];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(Math.abs(len - 2 / 5) < 1e-9, `edge length ${len}`);
    const ang = ((Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) % 180 + 180) % 180;
    const kAng = ((e.family * 36) % 180 + 180) % 180; // family k: direction k·36°
    const diff = Math.min(Math.abs(ang - kAng), 180 - Math.abs(ang - kAng));
    assert.ok(diff < 1e-6, `family ${e.family} edge at ${ang}°`);
  }
});

test('generic γ: two rhombi only — thick 72°, thin 36° — and the core ratio tends to φ', () => {
  const m = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
  const { tiles } = m.dualTiles();
  const counts = { 36: 0, 72: 0 };
  for (const t of tiles) {
    const r = Math.hypot(t.at[0], t.at[1]);
    if (r > m.reach * 0.5) continue;          // core only: fringe is clipped
    const a = Math.round(t.angle * 180 / Math.PI);
    assert.ok(a === 36 || a === 72, `tile angle ${a}°`);
    counts[a]++;
  }
  const ratio = counts[72] / counts[36];
  assert.ok(Math.abs(ratio - PHI) < 0.15, `thick:thin ${ratio} ≈ φ`);
  assert.ok(counts[72] > 150 && counts[36] > 80, 'enough core tiles to matter');
});

test('γ=0 is singular: triple concurrences exist; generic γ has none', () => {
  const s = new Multigrid({ N: 5, gamma: SINGULAR, reach: 3 });
  let triple = 0;
  for (const v of s.arrangementVertices()) if (v.lines.length > 2) triple++;
  assert.ok(triple >= 30, `γ=0 has ${triple} triple concurrences`);
  const g = new Multigrid({ N: 5, gamma: GENERIC, reach: 3 });
  for (const v of g.arrangementVertices()) assert.ok(v.lines.length === 2, 'generic γ: every vertex is an ordinary crossing');
});

test('singular γ=0: the dual is still edge-rigid (all 2/5) but breaks rhombicity', () => {
  const m = new Multigrid({ N: 5, gamma: SINGULAR, reach: 3 });
  const { faces, edges, tiles } = m.dualTiles();
  for (const e of edges) {
    const len = Math.hypot(faces[e.b].x - faces[e.a].x, faces[e.b].y - faces[e.a].y);
    assert.ok(Math.abs(len - 2 / 5) < 1e-9, 'equal edges even at the singularity');
  }
  // concurrence vertices skipped → tile count drops hard vs generic
  const g = new Multigrid({ N: 5, gamma: GENERIC, reach: 3 });
  assert.ok(tiles.length < g.dualTiles().tiles.length * 0.8, 'concurrences eat rhombi');
});

test('THE ICEBERG: family-k edge-lines sing the golden gaps — closed forms, core two-gap law, no two L adjacent', () => {
  const { S, L, SL } = goldenGaps();
  // closed forms, pinned to 9 decimals by probes at reach 4..12 (identical
  // at every size — structural constants, not size artifacts)
  const a = (2 / 5) * Math.sin(2 * Math.PI / 5);
  assert.ok(Math.abs(S - a * Math.pow(PHI, -3)) < 1e-12);
  assert.ok(Math.abs(L - a * Math.pow(PHI, -2)) < 1e-12);
  assert.ok(Math.abs(SL - S - L) < 1e-12, 'S+L is the long golden gap');
  assert.ok(Math.abs(L / S - PHI) < 1e-9, 'gap ratio is φ');

  const m = new Multigrid({ N: 5, gamma: GENERIC, reach: 12 });
  for (let k = 0; k < 5; k++) {
    const lines = edgeLines(m, k);
    const isL = g => Math.abs(g - L) < 2e-6;
    const isSL = g => Math.abs(g - SL) < 2e-6;
    const isS = g => Math.abs(g - S) < 2e-6;
    let nL = 0, nSL = 0, nS = 0, nBad = 0, seq = [];
    for (let i = 0; i + 1 < lines.length; i++) {
      const g = lines[i + 1].c - lines[i].c;
      const core = lines[i].midR < m.reach * 0.35 && lines[i + 1].midR < m.reach * 0.35;
      if (!core) continue;
      if (isSL(g)) { nSL++; seq.push('C'); }
      else if (isL(g)) { nL++; seq.push('L'); }
      else if (isS(g)) { nS++; seq.push('S'); }
      else nBad++;
    }
    assert.equal(nBad, 0, `family ${k}: every core gap is a golden gap`);
    assert.ok(nL >= 10 && nSL >= 10, `family ${k}: enough core gaps (${nL} L, ${nSL} S+L)`);
    const s = seq.join('');
    assert.ok(!s.includes('LL'), `family ${k}: no two L adjacent — the Fibonacci word law`);
    const freqL = nL / (nL + nSL);
    assert.ok(freqL > 0.25 && freqL < 0.62, `family ${k}: freq(L)=${freqL.toFixed(3)} in the golden band`);
  }
});

test('ANTI-VACUITY: detuned normals (alternating ±2°) break the golden gap law', () => {
  class Detuned extends Multigrid {
    constructor(o) {
      super(o);
      this.normals = this.normals.map((n, k) => {
        const a = Math.PI * k / 5 + (k % 2 ? 0.0349066 : -0.0349066);
        return [Math.cos(a), Math.sin(a)];
      });
    }
  }
  const { L, SL } = goldenGaps();
  const m = new Detuned({ N: 5, gamma: GENERIC, reach: 6 });
  const lines = edgeLines(m, 0);
  const uniq = new Set();
  for (let i = 0; i + 1 < lines.length; i++) {
    if (lines[i].midR < m.reach * 0.35 && lines[i + 1].midR < m.reach * 0.35)
      uniq.add(Math.round((lines[i + 1].c - lines[i].c) * 1e6));
  }
  // the golden law has EXACTLY two core gap values (L, S+L); the detuned
  // grid shows more — and its smallest ratio is not φ
  assert.ok(uniq.size >= 3, `detuned: ${uniq.size} distinct core gaps (law gives exactly 2)`);
  const arr = [...uniq].sort((x, y) => x - y);
  assert.ok(Math.abs(arr[1] / arr[0] - PHI) > 0.01, 'detuned smallest-gap ratio is not φ');
  // and the rhombi split: more than two tile angles
  const { tiles } = m.dualTiles();
  const angles = new Set(tiles.map(t => Math.round(t.angle * 180 / Math.PI)));
  assert.ok(angles.size > 2, `detuned tile angles ${[...angles].join(',')}`);
  // sanity: the golden constants are not accidentally there
  assert.ok(!uniq.has(Math.round(L * 1e6)) || !uniq.has(Math.round(SL * 1e6)));
});

test('the window is bounded and its radius converges with reach (finite patch samples a fixed acceptance domain)', () => {
  const radii = [];
  for (const reach of [4, 7]) {
    const m = new Multigrid({ N: 5, gamma: GENERIC, reach });
    const wc = m.windowCoords();
    const dim = wc[0].length;
    const mean = Array.from({ length: dim }, (_, i) => wc.reduce((a, w) => a + w[i], 0) / wc.length);
    let r = 0;
    for (const w of wc) r = Math.max(r, Math.hypot(...w.map((q, i) => q - mean[i])));
    radii.push(r);
  }
  assert.ok(Math.abs(radii[1] - radii[0]) < 0.05, `window radius stable: ${radii[0].toFixed(4)} → ${radii[1].toFixed(4)}`);
  assert.ok(radii[0] > 0.5 && radii[0] < 2, 'window is a bounded domain');
});

test('γ=0 patch is exactly centrally symmetric through the origin (the singular symmetry)', () => {
  const m = new Multigrid({ N: 5, gamma: SINGULAR, reach: 3 });
  const wc = m.windowCoords();
  const set = new Set(wc.map(w => w.map(q => Math.round(q * 1e5)).join(',')));
  let sym = 0;
  for (const w of wc) if (set.has(w.map(q => Math.round(-q * 1e5)).join(','))) sym++;
  assert.equal(sym, wc.length, 'every window point has its negative');
});

for (const [label, K] of kernels) {
  test(`${label}: the multigrid hosts as kernel cells and fam-k links`, () => {
    const k = new K();
    const m = new Multigrid({ N: 5, gamma: GENERIC, reach: 3 });
    const { vertices, edges } = m.host(k);
    assert.equal(k.cells('mg.v.').length, vertices);
    assert.equal(k.links().filter(l => l.type.startsWith('fam')).length, edges);
    const v0 = k.view('mg.v.0');
    assert.equal(typeof v0.x, 'number');
    assert.ok(Array.isArray(v0.lift) && v0.lift.length === 5, 'lift is the ℤ⁵ address');
    assert.equal(k.metaOf('mg.v.0').index, 0);
  });
}
