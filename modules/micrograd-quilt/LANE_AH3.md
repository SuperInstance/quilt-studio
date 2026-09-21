# Lane AH³ — micrograd + quilt fused lattice kernel

> An MMX-M3 critic amendment (M3-01). Implements the architecture on a quilt
> cell grid: autograd where identity is never a float, backprop is a
> relaxation sweep, and Karpathy's 3 structural questions get answers.

## What this is

`lattice_engine.py` is a NEW substrate alongside karpathy/micrograd
(`micrograd/engine.py`, `micrograd/nn.py` are **untouched** — baseline suite
stays green). It re-asks autograd from the quilt side:

- **Fused lattice kernel.** The value/grad tensor lives ON a 2D integer
  `(k, s)` quilt cell grid. Neighbor relations on the grid ARE the broadcast
  graph: a cell op reads its parent cells, writes value+grad to itself.
- **Identity never floats.** Every number is a q16 exact rational — a
  `(num:int64, den:int64)` pair, the ℚ×10⁶ fixed-point codec. Floats may only
  touch display (`to_float()` is a projection, never fed back).
- **Backprop = relaxation.** Gauss-Seidel delta sweeps over the grid, not a
  topological recursion — cycles in the graph are legal (`placeholder` +
  `rewire` close them). DAG-legal graphs terminate with exact zero residual;
  cyclic graphs terminate at an exact disclosed resolution floor.
- **Semantic ops.** `QAdd`, `QMul` (exact rational), `commensurate(a, b)`
  (the comb answer: ratio's denominator divides 10⁶ — `(1/3)*3` vs `1` is
  TRUE, `1/3` vs `1` is a ternary ghost on a decimal quilt), and `twist(v, K)`
  (twist-law: `k ↦ k △ K`, `R ↦ 1−R`, involution, shadow pairs `R + S = 1`).

## Karpathy's 3 questions (run `python3 demos.py`)

| # | Question | Lattice answer |
|---|----------|----------------|
| Q1 | Where do my numbers live? | Gradients inhabit a **region of the (k,s) grid** — `describe_gradient()` prints the bounding box and every cell's exact grad. |
| Q2 | Are these two gradients commensurate? | **Exact comb predicate**, not float epsilon: `0.1+0.2` vs `0.3` → floats say False, the comb says TRUE. |
| Q3 | What did backward cost in fuel? | **FuelReceipt**: per-op mul/add counts × lattice-hop distance, sweep count, exact residual — deterministic sha256 (same graph → same receipt). |

## Tests

```
python3 -m pytest test/ test_lattice.py -q     # 39 passed
```

- baseline micrograd suite untouched and green (2)
- q16 codec exactness (9), semantic ops (9)
- gradient equivalence vs micrograd on DAG-legal graphs (8)
- relaxation convergence on a true cyclic graph (2)
- topology-aware region reporting (3), fuel determinism (3), invariants (3)

## Deviation disclosures

1. SuperInstance/micrograd does not exist → cloned karpathy/micrograd;
   this lane pushes to its own repo instead of upstream.
2. Exact rational arithmetic has no epsilon floor: cyclic relaxation
   terminates when the per-sweep delta ≤ an exact resolution rational
   (default 0 for exact DAG termination; cyclic graphs disclose their
   residual on the receipt).
3. `Twist`'s lattice law is `k △ K` (integer xor on the k-axis — exact,
   identity-safe) with value law `R ↦ 1−R`; the spec's `A△K` is realized as
   xor, the involution reading of the twist law.
