# EXP-A2 — Long-horizon timebase: ticking a floor for 100,000 steps

**Lane A, round 3 · axes: TIMEBASE × DIRECTION × SCALE** (round 2 was all static construction; this probe makes the floor a dynamical system)

## Hypothesis

Under a γ-sweep the floor should conserve its *relative* geometry exactly (positions derive in closed form from (lift, γ)) while the observation window churns at its boundary. The open question is the stability wall: does identity tracking fail gradually (accumulated drift) or suddenly (a knife-edge)?

## Method

Three phases, each run twice (bit-identical; 44 s for both runs):

1. **Sweep — 100,000 ticks**: γ_t = GENERIC + t·δ with mixed δ = (0.31, −0.17, 0.53, 0.11, −0.29)·1e-6 (internal shear, not pure translation). Faces tracked by lift identity; per-tick positions recomputed exactly via the strip formula; existence reconciled against a full dual rebuild every 200 ticks (501 rebuilds). Tracked: window face count (R=1.5), births/deaths, t=0-persistent faces in window, pairwise-distance drift of sampled persistent pairs, family-0 golden-word freq(L).
2. **Stability wall**: all-equal per-tick step g over 11 amplitudes 1e-6…0.5; track the central lift for 500 ticks; break = per-tick jump > 0.2 (half edge) or lift death (rebuild check every 100 ticks).
3. **Reach horizon**: reach 4→24 step 2 — bitwise position conservation of shared faces, freq(L) stability, fringe sensitivity.

## Twice-run numbers

**Sweep.** births total = 140, deaths total = 140 (exactly balanced — the sweep is divergence-free in lift-space). Window count 54 → 56 over 100k ticks (quasi-conserved density). Sampled pairwise distances drift ≤ 1.5e-15 across the *entire* sweep — relative geometry is conserved to machine epsilon. freq(L) holds in [0.40, 0.42] (golden band). Max displacement of any still-persistent t=0 face at t=100k: 0.025 lattice units — bounded, no runaway.

**Stability wall.**

| g | max jump/tick | tracked 500? | died at |
|---|---|---|---|
| 1e-6 | 1.2944e-6 | yes | — |
| 1e-3 | 1.2944e-3 | yes | — |
| 0.01 | 0.0129 | **no** | t=200 |
| 0.1 | 0.1294 | no | t=100 |
| 0.1546 | 0.2001 | no | t=100 |
| 0.5 | 0.6472 | no | t=100 |

The analytic knife-edge for all-equal δ is g* = 0.2 / (2/5·|Σn_k|) = **0.15451** (since lift-position is affine in γ, per-tick displacement = (2/5)·g·|Σn_k| = 1.2944·g — confirmed to 12 digits empirically). But every g ≥ 0.01 loses the tracked lift to *existence failure* (it exits the reach-4 window) long before the jump wall: the practical wall is the window, not accuracy. The jump wall g* was never reached in-window.

**Reach horizon.** Shared-face position diff vs reach 4: **exactly 0 at every reach** (positions derive only from (lift, γ)). `sharedWithReach4`: 1533 → 1567 — 34 faces of the reach-4 patch (2.2%) are absent at reach 6 and return by reach 14: fringe under-split artifacts, horizon-sensitive. freq(L) stable 0.40–0.42 throughout; bad (fringe) gaps grow linearly with reach as expected.

## Boundary segment

A floor ticked adiabatically is a *rigid* system: relative geometry conserved to 1e-15, window density quasi-conserved, lift-space flow divergence-free (births = deaths exactly). The timebase wall is **existence**, not precision: identity tracking is valid while the face remains inside the patch, and the binding constraint is window-crossing time ≈ R/(1.2944·g). The accuracy knife-edge g* = 0.1545 exists mathematically but is preempted by the window everywhere practical.

## Why the wall is where it is

Positions are affine in γ (the strip formula is linear), so per-tick motion is constant-velocity with zero accumulation — there is nothing to drift. Death is geometric: a lift's cell empties when a strip boundary sweeps past it, which happens at a rate set by the sweep velocity projected on each family normal. The window converts the unbounded-parameter sweep into a finite tracking time, and that conversion — not float error — is the wall.

## Three next probes (maximally different)

1. **EXP-B4 (adversary × timebase)**: tick *through* the A1 corruption band (park at ε=3e-8, sweep) — does the frozen zone thaw under motion, and do corrupted patches migrate?
2. **EXP-B5 (scale)**: window-crossing scaling law — measure tracking lifetime vs g at multiple reaches to extract the boundary-layer exponent; test whether births/deaths ever unbalance (non-divergence-free flow) near the fringe.
3. **EXP-B6 (domain)**: periodic γ (closed orbit in γ-space, e.g. γ(t)=0.1+0.05·sin(t)·per-family phases) — is the flow recurrent? Do lifts return (Poincaré-style) or is the mixing irreversible?
