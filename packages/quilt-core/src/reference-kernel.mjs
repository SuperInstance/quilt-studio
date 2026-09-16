// quilt-core reference kernel — the L1 contract in executable form.
// Any kernel claiming quilt-vm compatibility (WASM, JS, Rust-wasm) must pass
// tests/kernel-contract.test.mjs unmodified. This JS reference exists so the
// contract is runnable before quilt-vm-wasm is wired in.
//
// Contract sources: SuperInstance/quilt-vm-wasm README (BIND/LINK/EFFECT/VIEW/TICK)
// + design/2026-09-17-quilt-studio-thesis.md (sections 4, 9).

export class QuiltKernel {
  constructor() {
    this.cells = new Map();     // name -> value
    this.edges = new Map();     // edgeId -> {from, to, type}
    this.ops = new Map();       // cell -> Map(opName -> {forward, inverse})
    this.history = [];          // {cell, op, before}
    this.queue = [];            // {cell, op} flushed on tick, FIFO
    this.ts = 0;
  }

  bind(name, value) {
    assertName(name);
    if (!isJSON(value)) throw new TypeError('bind: value must be JSON-serializable');
    this.cells.set(name, value);
    return name;
  }

  view(name) {
    return this.cells.has(name) ? this.cells.get(name) : null;
  }

  link(a, b, type) {
    assertName(a); assertName(b);
    if (!this.cells.has(a)) throw new Error(`UnknownCell: ${a}`);
    if (!this.cells.has(b)) throw new Error(`UnknownCell: ${b}`);
    const id = `${a}->${b}:${type}`;
    if (!this.edges.has(id)) this.edges.set(id, { from: a, to: b, type });
    return id;
  }

  links(from = null) {
    return [...this.edges.values()].filter(e => from === null || e.from === from);
  }

  effect(name, opName, forward, inverse) {
    if (!this.cells.has(name)) throw new Error(`UnknownCell: ${name}`);
    if (typeof forward !== 'function' || typeof inverse !== 'function')
      throw new TypeError('effect: forward and inverse must be functions');
    if (!this.ops.has(name)) this.ops.set(name, new Map());
    this.ops.get(name).set(opName, { forward, inverse });
  }

  apply(name, opName) {
    const cellOps = this.ops.get(name);
    const op = cellOps && cellOps.get(opName);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.cells.get(name);
    this.cells.set(name, op.forward(before));
    this.history.push({ cell: name, op: opName, before });
    return this.cells.get(name);
  }

  undo() {
    const h = this.history.pop();
    if (!h) return false;
    this.cells.set(h.cell, h.before);
    return true;
  }

  queueEffect(name, opName) {
    assertName(name); assertName(opName);
    this.queue.push({ cell: name, op: opName });
  }

  tick(dt = 1) {
    this.ts += dt;
    const applied = [];
    while (this.queue.length) {
      const { cell, op } = this.queue.shift();
      applied.push({ cell, op, value: this.apply(cell, op) });
    }
    return { ts: this.ts, applied };
  }

  now() { return this.ts; }

  snapshot() {
    return {
      cells: Object.fromEntries(this.cells),
      links: this.links(),
      ts: this.ts,
      historyDepth: this.history.length,
      queued: this.queue.length,
    };
  }
}

function assertName(n) {
  if (typeof n !== 'string' || n.length === 0) throw new TypeError('name must be a non-empty string');
  if (n.length > 256) throw new TypeError('name exceeds 256 chars');
}

function isJSON(v) {
  try { JSON.stringify(v); return typeof v !== 'function' && typeof v !== 'undefined'; }
  catch { return false; }
}
