// Contract suite against the REAL quilt-vm-wasm WASM kernel via the L1 adapter.
// This is the gate that matters: the same 28 tests, unmodified, over the
// vendored WASM build (vendor/quilt_vm_wasm_bg.wasm).
import { runContractSuite } from './contract-suite.mjs';
import { WasmQuiltKernel } from '../src/wasm-kernel.mjs';

runContractSuite('wasm', () => new WasmQuiltKernel());
