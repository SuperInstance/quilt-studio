# Crabbox — the fleet's runner

quilt-crabbox (<https://github.com/SuperInstance/quilt-crabbox>, fork of
openclaw/crabbox) is the ecosystem's execution layer: **warm a box, sync the
diff, run the suite, stream the evidence.** Keep editing locally; crabbox
ships the working tree to a box and returns the exit code.

## Why it fits the quilt

Every floor app is deterministic — mulberry32-seeded, both kernels
differential-fuzzed. A synced diff plus the seed IS the reproduction: any
box that runs the suite produces byte-comparable evidence. Crabbox turns
that into a workflow:

```sh
crabbox job run full-suite        # 113 core + 109 floor, streamed
```

The job commands are byte-identical to `.github/workflows/test.yml` — CI,
the local checkout, and a warm box all run the same suite. No lockfile
drift: both packages now ship `package-lock.json`; boxes run `npm ci`.

## Jobs (`.crabbox.yaml`)

| Job | Runs |
|-----|------|
| `core-suite` | `packages/quilt-core` — contract suite, reference + WASM kernels, differential fuzz |
| `floor-suite` | `packages/quilt-floor` — all floor apps on both kernels + repo-claims doc drift guard |
| `full-suite` | both, in CI order |

Default provider is `local-container` (needs Docker/Podman on the invoking
machine). Everything is overridable per invocation — flags beat config:

```sh
crabbox job run floor-suite --provider ssh --id fleet-box   # reuse a warm fleet box
crabbox job list                                            # verify without touching a box
```

## Honest status

- The job command strings were proven locally (113/113 core, 109/109
  floor, this host, npm ci from the new lockfiles).
- No live `crabbox run` smoke has been executed from this repo yet — this
  host has no Docker/Podman. First live run is pending any box with an
  engine (or an SSH host / coordinator per the provider matrix).
- Upstream delta: the SuperInstance fork currently carries **zero**
  fork-only commits. The quilt flavor lives here (jobs + this doc) until a
  fork-side change is justified by use.

## Roadmap (not built, ranked by leverage)

1. **Named job per floor app** — `comb-suite`, `multigrid-suite`, … so a
   breeding run can demand evidence for exactly the law it mutates.
2. **Coordinator-backed fleet boxes** — shared capacity with spend caps and
   lease expiry; the breeding daemon runs suites on warm boxes overnight.
3. **Pond peer groups for floor swarms** — multi-box runs of the same seed
   across kernels/providers; evidence diffed on return (the determinism
   guarantee makes cross-box differential testing free).
4. **A quilt provider?** Only if a future fleet box speaks the quilt wire
   natively. Premature today — jobs cover the need.
