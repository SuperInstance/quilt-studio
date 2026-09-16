// hello-quilt — the 10-line tour. Run: node examples/hello-quilt.mjs
import { QuiltKernel } from '../packages/quilt-core/src/reference-kernel.mjs';
// Swap one line to run on the real WASM kernel instead:
// import { WasmQuiltKernel as QuiltKernel } from '../packages/quilt-core/src/wasm-kernel.mjs';

const quilt = new QuiltKernel();

// cells are named JSON values
quilt.bind('tempo', 120);
quilt.bind('filter.cutoff', { hz: 800, q: 1.2 });
quilt.bind('lfo', 0.25);

// typed edges between them
quilt.link('lfo', 'filter.cutoff', 'modulates');

// effects are declared bidirectional (forward + inverse), then applied
quilt.effect('tempo', 'halve', v => v / 2, v => v * 2);
quilt.apply('tempo', 'halve');
console.log('tempo after halve:', quilt.view('tempo'));   // 60

// undo walks the global history stack
quilt.undo();
console.log('tempo after undo: ', quilt.view('tempo'));   // 120

// the DAW clock: queue effects, flush them on tick
quilt.queueEffect('tempo', 'halve');
const frame = quilt.tick(1 / 60);
console.log('frame ts:', frame.ts.toFixed(4), 'applied:', frame.applied.map(a => `${a.cell}.${a.op}`));

// snapshot is the whole studio state — distill it, hydrate it later
console.log('snapshot cells:', Object.keys(quilt.snapshot().cells));
