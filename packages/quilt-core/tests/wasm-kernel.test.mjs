// Contract suite against the REAL quilt-vm-wasm WASM kernel via the L1 adapter.
// This is the gate that matters: the same contract tests, unmodified, over the
// vendored WASM build (vendor/quilt_vm_wasm_bg.wasm).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runContractSuite } from './contract-suite.mjs';
import { WasmQuiltKernel, edgeId as wasmEdgeId } from '../src/wasm-kernel.mjs';
import { edgeId as refEdgeId } from '../src/reference-kernel.mjs';

runContractSuite('wasm', () => new WasmQuiltKernel());

test('module-surface parity: edgeId exported from both kernels agrees', () => {
  assert.equal(wasmEdgeId('a->b', 'c', 'x:y'), refEdgeId('a->b', 'c', 'x:y'));
  assert.equal(wasmEdgeId('plain', 'names', 'type'), 'plain->names:type');
});
