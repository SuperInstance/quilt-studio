// sceneToMermaid — the kernel's cell/link graph as a Mermaid diagram.
//
// Synergy with SuperInstance/quilt-mermaid (canon citation graphs): the
// same idea one layer down — the LIVE cell graph instead of the canon
// graph. Feeds any Markdown doc or the mermaid.live editor. Pure function
// over RenderModel.scene(); deterministic output (sorted, escaped).
//
// Escaping is total: node IDs allow only [a-zA-Z0-9_]; labels are
// sanitized (quotes/control chars stripped, --> defused to →) before they
// enter the quoted label. A hostile cell name cannot forge an edge line.

const escId = s => [...s].map(ch =>
  /[a-zA-Z0-9_]/.test(ch) ? ch : `_${ch.codePointAt(0).toString(16)}`).join('');

const escLabel = s => [...s.replace(/-->/g, '→')].map(ch =>
  /[a-zA-Z0-9 ._\-/]/.test(ch) ? ch : `_${ch.codePointAt(0).toString(16)}`).join('');

export function sceneToMermaid(scene, { direction = 'LR', title = null } = {}) {
  const lines = [`graph ${direction}`];
  if (title) lines.push(`  %% ${title}`);
  const nodes = [...scene.nodes].sort((a, b) => a.name.localeCompare(b.name));
  const byName = new Map(nodes.map(n => [n.name, n]));
  const edges = [...scene.edges].sort((a, b) =>
    (a.from + a.to + a.type).localeCompare(b.from + b.to + b.type));

  for (const n of nodes) {
    const label = n.name.length > 24 ? n.name.slice(0, 21) + '…' : n.name;
    const shape = Array.isArray(n.value) ? `["${escLabel(label)}"]` : `("${escLabel(label)}")`;
    lines.push(`  ${escId(n.name)}${shape}`);
  }
  for (const e of edges) {
    if (!byName.has(e.from) || !byName.has(e.to)) continue; // dangling edge
    lines.push(`  ${escId(e.from)} -- "${escLabel(e.type)}" --> ${escId(e.to)}`);
  }
  lines.push(`  %% t=${scene.t} nodes=${nodes.length} edges=${edges.length}`);
  return lines.join('\n');
}
