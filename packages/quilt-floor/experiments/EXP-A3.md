# EXP-A3 — The floor as a computer: dataflow evaluation on the dual graph

**Lane A, round 3 · axes: DOMAIN × DIRECTION** (maximally far from round 2's physics/algebra substrates: this is compilation/scheduling; embedding direction is top-down, program-onto-floor)

## Hypothesis

The dual graph (faces = cells, edges = family-typed links) admits a potential-based orientation making it a DAG, so a patch should *evaluate* straight-line programs with ≤5 op types and bounded fan-in. "Does order matter?" splits by arithmetic layer: exact-integer evaluation should be schedule-invariant; float arrival-accumulation should spread by rounding.

## Method

1. **Structure**: degree histogram of the dual graph, fringe vs interior (fringe = |position| ≥ 0.4·reach), generic and singular γ.
2. **Orientation**: potential p_λ(j) = Σ λ_k·j_k with all λ_k ≠ 0; every dual edge changes exactly one lift component by ±1 ⇒ Δp = ±λ_k ≠ 0 ⇒ strict orientation, and any directed cycle would sum strictly positive steps to 0 — impossible by construction. Kahn's algorithm verifies; 300 random linear extensions sampled per orientation. Four orientations: three generic-λ (including negative components), one on the singular γ=0 substrate.
3. **Embedding limits**: op-type count (5 families — hard), fan-in (≤ interior max degree — hard), cycles (un-schedulable by construction).
4. **Evaluation**: radius-3 ball around the central face (21 nodes, max in-degree 3), input nodes seeded (int: exact ℤ; float: /3 non-representable), per-family ops (+, ×, −, max, mean). 400 randomized valid schedules on the *same* DAG; integer mode = set semantics per node, float mode = schedule-order arrival accumulation.

## Twice-run numbers (seeded PRNG, reseeded between runs; bit-identical)

**Structure (reach 5).** Fringe (35% of the patch!) has degrees 1–2 — pure reach-clipping artifacts. Interior histogram: generic γ {3: 44, 4: 15, 5: 31, 7: 5}, **max interior degree 7** — matches the P3 vertex-figure families; singular γ=0 interior {3: 60, 5: 10}, max 5: the singularity prunes high-degree vertices.

**Orientation.** All four orientations acyclic — Kahn visits 2263/2263 (generic) and 2020/2020 (singular); all 300 random extensions valid each time. The DAG theorem holds empirically on both substrates, including mixed-sign λ.

**Embedding limits (the NO-GOs).**
- op types: exactly **5**, hard limit (typed links are the substrate).
- fan-in: ≤ **7** at generic γ (≤ 5 at γ=0) — no node admits more inputs than its degree.
- cycles: **feedback cannot be scheduled** — every p-orientation is acyclic by construction; the floor computes exactly the straight-line (DAG) fragment of any program.

**Evaluation.** 400 schedules on one 21-node DAG:
- **integer sinks: 1 distinct output vector** — schedule-invariant (set semantics, exact arithmetic).
- **float-arrival sinks: 4 distinct output vectors** — order matters, but only at the accumulated-rounding level; all variants agree to ~1e-15 relative.

## Boundary segment

A Penrose floor patch is a sound evaluator for the fragment {straight-line DAG, ≤5 op types, fan-in ≤7 (generic) / ≤5 (singular)}. Scheduling is free — every linear extension is valid and exact arithmetic makes it semantics-preserving. The no-gos are structural, not numeric: more op types, wider fan-in, or feedback all fail at *embedding time*, before any number is computed. The only order-sensitivity lives in float arrival-accumulation, where one 3-input node already splits 400 schedules into 4 rounding variants.

## Why the wall is where it is

Acyclicity is not a numeric accident but a theorem: the lift lattice is totally ordered by any separating linear functional, and every edge is a unit step in one coordinate. Fan-in and op-type walls are conservation laws of the substrate (5 families, cell side-counts). Float order-sensitivity appears only when a node has ≥3 inputs — with 2 inputs, commutativity makes even float addition order-free — so the sensitivity threshold is *node arity 3*, a pleasantly sharp result.

## Three next probes (maximally different)

1. **EXP-B7 (adversary × domain)**: adversarial schedules — can a valid linear extension be chosen to *maximize* float sink divergence (greedy worst-order)? Measure the controllable spread vs the random 4-variant baseline.
2. **EXP-B8 (scale × domain)**: does the fan-in-7 bound grow with reach (are degree-8+ cells ever interior at reach 20/50), or is 7 a hard P3 ceiling? Settle whether the embedding class is size-independent.
3. **EXP-B9 (substrate × domain)**: evaluate on an N=4 Ammann–Beenker floor (A1 showed the construction is N-robust): op types drop to 4, interior degrees change — is the whole fragment statement a corollary of N?
