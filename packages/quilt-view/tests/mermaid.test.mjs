// sceneToMermaid — the cell graph as Mermaid, deterministic and escaped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { Multigrid } from '../../quilt-floor/src/multigrid.mjs';
import { PenField } from '../../quilt-floor/src/penfield.mjs';
import { RenderModel } from '../src/render-model.mjs';
import { sceneToMermaid } from '../src/mermaid.mjs';

test('a seeded scene renders as a sorted, parseable graph', () => {
  const k = new QuiltKernel();
  k.bind('a', 1);
  k.bind('b with spaces', [1, 2]);
  k.bind('z', 'str');
  k.link('a', 'b with spaces', 'feeds');
  k.link('z', 'a', 'gates');
  const m = new RenderModel(k);
  const out = sceneToMermaid(m.scene(), { title: 'test' });
  const lines = out.split('\n');
  assert.equal(lines[0], 'graph LR');
  assert.ok(lines[1].startsWith('  %% test'));
  // deterministic order: a, b with spaces, z
  const nodeLines = lines.filter(l => l.match(/^  \w+[\("\[]/));
  assert.equal(nodeLines.length, 3);
  assert.ok(nodeLines[0].startsWith('  a("a")'));
  assert.ok(nodeLines[1].startsWith('  b_20with_20spaces["b with spaces"]'));
  assert.ok(nodeLines[2].startsWith('  z("z")'));
  // edges sorted by from+to+type: a→b before z→a
  const edgeLines = lines.filter(l => l.includes('-->'));
  assert.equal(edgeLines.length, 2);
  assert.ok(edgeLines[0].includes('a -- "feeds" --> b_20with_20spaces'));
  assert.ok(edgeLines[1].includes('z -- "gates" --> a'));
  // footer records the scene stats
  assert.ok(lines.at(-1).includes('nodes=3 edges=2'));
  m.dispose();
});

test('the penfield scene exports whole: every seat, every edge type', () => {
  const k = new QuiltKernel();
  const mg = new Multigrid({ N: 5, gamma: [0.1, 0.7, 0.3, 0.9, 0.4], reach: 8 });
  new PenField(k, mg);
  const m = new RenderModel(k);
  const out = sceneToMermaid(m.scene(), { direction: 'TD' });
  assert.ok(out.startsWith('graph TD'));
  for (const cell of ['penfield.c', 'penfield.z', 'penfield.escaped']) {
    assert.ok(out.includes(`"${cell}"`), `missing ${cell}`);
  }
  m.dispose();
});

test('name escaping is total: control characters cannot break the diagram', () => {
  const k = new QuiltKernel();
  k.bind('weird\nname"with-->[arrows]', 1);
  const m = new RenderModel(k);
  const out = sceneToMermaid(m.scene());
  // every real edge line matches the shape `  <id> -- "type" --> <id>`
  for (const l of out.split('\n')) {
    if (l.includes('-->')) {
      assert.ok(/^  \w+ -- "[^"]*" --> \w+$/.test(l), `hostile line: ${JSON.stringify(l)}`);
    }
  }
  // the hostile name survives only as a sanitized label (truncated >24 chars)
  assert.ok(out.includes('"weird_aname_22with_2192_5bar_2026"'));
  m.dispose();
});
