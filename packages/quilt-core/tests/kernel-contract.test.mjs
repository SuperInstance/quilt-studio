// Contract suite against the reference JS kernel.
import { runContractSuite } from './contract-suite.mjs';
import { QuiltKernel } from '../src/reference-kernel.mjs';

runContractSuite('reference', () => new QuiltKernel());
