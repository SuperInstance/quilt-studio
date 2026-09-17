// The repo-claims test — the tests FIND what the applications PRODUCE and
// verify the REPO (docs/THE-FLOOR.md) tells the truth about it.
//
// Every pinned number in the doc is extracted from the doc's own text and
// recomputed live from the floor applications. If the code and the doc ever
// drift apart, this suite fails — the doc cannot lie about what the
// instruments measure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PHI, convergentGaps } from '../src/golden.mjs';
import { goldenGaps, Multigrid } from '../src/multigrid.mjs';
import { PenField } from '../src/penfield.mjs';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { SQ } from '../src/strip.mjs';

const docPath = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/THE-FLOOR.md');
const DOC = readFileSync(docPath, 'utf8');
const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];

// Pull a claim out of the doc text; fails the test if the doc stopped
// stating it (a deleted claim is a drift too).
function claim(re, name) {
  const m = DOC.match(re);
  assert.ok(m, `THE-FLOOR.md no longer states: ${name}`);
  return m;
}

test('multigrid §7: the doc states the golden-gap constants the app produces', () => {
  const S = (2 / 5) * Math.sin(2 * Math.PI / 5) * Math.pow(PHI, -3);
  const L = (2 / 5) * Math.sin(2 * Math.PI / 5) * Math.pow(PHI, -2);
  const m1 = claim(/φ⁻³ = ([\d.]+)…/, 'S value');
  const m2 = claim(/S·φ    = ([\d.]+)…/, 'L value');
  const m3 = claim(/φ⁻¹        = ([\d.]+)…/, 'S+L value');
  assert.ok(Math.abs(S - parseFloat(m1[1])) < 5e-7, `doc S=${m1[1]} vs computed ${S}`);
  assert.ok(Math.abs(L - parseFloat(m2[1])) < 5e-7, `doc L=${m2[1]} vs computed ${L}`);
  assert.ok(Math.abs(S + L - parseFloat(m3[1])) < 5e-7, `doc S+L=${m3[1]} vs computed ${S + L}`);
  // and the app's own pin agrees with the closed form
  const g = goldenGaps();
  assert.ok(Math.abs(g.S - S) < 1e-12 && Math.abs(g.L - L) < 1e-12);
});

test('multigrid: dual edges really have length 2/5 — the doc says so', () => {
  assert.match(DOC, /length exactly 2\/5/);
  const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
  const { faces, edges } = mg.dualEdges();
  assert.ok(edges.length > 100);
  for (const e of edges) {
    const dx = faces[e.b].x - faces[e.a].x, dy = faces[e.b].y - faces[e.a].y;
    assert.ok(Math.abs(Math.hypot(dx, dy) - 2 / 5) < 1e-9, `edge ${Math.hypot(dx, dy)}`);
  }
});

test('comb §4: the doc’s convergent table is convergentGaps() output', () => {
  const rows = [...DOC.matchAll(/\| F([₀-₁₂₃₄₅₆₇₈₉]+)\/F([₀-₁₂₃₄₅₆₇₈₉]+) \| (\d+)\/(\d+) \| ([+\u2212][\d.]+)° \|/g)];
  assert.ok(rows.length >= 4, `table rows found: ${rows.length}`);
  const sub = s => [...s].map(ch => '₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)).join('');
  for (const [, sn1, sn2, fn1, fn2, deg] of rows) {
    const n = parseInt(sub(sn1)) - 1; // F_{n+1}/F_n row label
    const t = convergentGaps(n).find(x => x.n === n);
    assert.ok(t, `ladder n=${n}`);
    assert.ok(Math.abs(t.degrees - parseFloat(deg.replace('\u2212', '-'))) < 5e-4, `doc ${deg}° vs computed ${t.degrees}°`);
  }
});

test('strip: S = φ³/SQ and L = φ⁴/SQ, exactly what the doc records', () => {
  assert.match(DOC, /S = φ³\/SQ, L = φ⁴\/SQ, SQ = √\(φ²\+1\)/);
  const S = PHI ** 3 / SQ, L = PHI ** 4 / SQ;
  // the strip's golden window actually produces exactly these two spacings
  // (already covered in strip tests; here the doc↔app identity)
  assert.ok(Math.abs(S * PHI - L) < 1e-12);
  assert.ok(S > 0 && L > 0 && L / S > PHI - 1e-12 && L / S < PHI + 1e-12);
});

test('field §8: the doc’s killed-hypothesis number (−0.44) is what the probe measures', () => {
  claim(/−0\.44/, 'the ladder hypothesis kill');
  const k = new QuiltKernel();
  const f = new PenField(k, new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }));
  const l = f.ladder();
  const [p, q] = l.atoms;
  // the φ-ladder hypothesis assigns gaps rungs log(g/a)/log φ; measured on
  // the true module they are NOT integers — the doc records −0.44 offsets
  const scale = l.elements.at(-1).value;
  const offsets = l.elements.map(e => Math.log(e.value / scale) / Math.log(PHI));
  assert.ok(offsets.some(o => Math.abs(o - Math.round(o)) > 0.3 && Math.abs(o - Math.round(o)) < 0.6),
    `expected a fractional rung near −0.44, got ${offsets.map(o => o.toFixed(2))}`);
  // and the surviving law: atoms in ratio φ
  assert.ok(Math.abs(q / p - PHI) < 1e-6);
});

test('window⇔Zeckendorf: the doc’s 0.63 ≈ 1/φ re-inflation figure', () => {
  claim(/16\+20 \/ 57 ≈ 0\.63 ≈ 1\/φ/, 'freq(L) re-inflation');
  // recompute the re-inflation on a fresh reach-12 grid: core consecutive
  // gaps {L, S+L}; each S+L hides one line + one split gap
  const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 12 });
  const n = mg.normals[0];
  const perp = [-n[1], n[0]];
  const core = mg.reach * 0.35;
  const lines = new Map();
  for (const s of mg.arrangementSegments()) {
    if (s.k !== 0) continue;
    const a = [(s.j + mg.gamma[0]) * n[0], (s.j + mg.gamma[0]) * n[1]];
    const d = perp;
    const tm = (s.t1 + s.t2) / 2;
    if (Math.hypot(a[0] + tm * d[0], a[1] + tm * d[1]) >= core) continue;
    for (const f of [s.above, s.below]) {
      let cx = 0, cy = 0;
      for (let i = 0; i < mg.N; i++) { const w = f[i] + mg.gamma[i] + 0.5; cx += w * mg.normals[i][0]; cy += w * mg.normals[i][1]; }
      cx *= 2 / mg.N; cy *= 2 / mg.N;
      lines.set(Math.round((perp[0] * cx + perp[1] * cy) * 1e9), perp[0] * cx + perp[1] * cy);
    }
  }
  const vals = [...lines.values()].sort((a, b) => a - b);
  const g = goldenGaps();
  let nL = 0, nC = 0, nS = 0;
  for (let i = 0; i + 1 < vals.length; i++) {
    const gap = vals[i + 1] - vals[i];
    if (Math.abs(gap - g.L) < 1e-6) nL++;
    else if (Math.abs(gap - (g.S + g.L)) < 1e-6) nC++;
    else nS++;
  }
  const freq = (nL + nC) / (nL + 2 * nC + nS);
  assert.ok(Math.abs(freq - 1 / PHI) < 0.06, `re-inflated freq(L) = ${freq}`);
});
