// TwistField — twist-engine's registration instrument seated on the floor.
//
// twist-engine app.js defines ONE instrument: registration R = mean
// gaussian alignment of a rotated point set B against a reference set A,
// R = mean_p∈B exp(−d²(p, A) / 2σ²), σ = 0.24·s, spatial hash cell 0.6·s,
// s = mean nearest-neighbor spacing. This module runs that EXACT law on
// the Penrose vertex set — the twist of a superstructure against the
// locational tiling.
//
// Probe-pinned laws (tests/twistfield.test.mjs):
//   • R(0) = 1 exactly (identity alignment).
//   • CLOUD LAW: for θ ≲ 2°, R(θ) ≈ exp(−⟨r²⟩θ² / 2σ²) — the rotated
//     cloud's self-alignment, with ⟨r²⟩ measured from the data. Verified
//     to 0.06% at 1°, 0.89% at 2°.
//   • Beyond ~2.5° the truth deviates UP from the cloud law: rotated
//     vertices start landing near OTHER vertex species — cross-alignment.
//     The deviation is the lattice's rotational fingerprint, and it is
//     γ-independent (universal for generic floors).
//   • KILLED by the same probe: fine magic-window teeth in 0–1° (none at
//     0.02° resolution — smooth falloff), and large-θ commensuration
//     peaks (the naive S-minimum at 24° is a disk-rim artifact, swamped
//     beyond σ/r_max ≈ 2.2°). The instrument is honest only inside the
//     twist regime, exactly as twist-engine runs it (0.15°–6°).

export class TwistField {
  constructor(points, { sigmaScale = 0.24, gridScale = 0.6 } = {}) {
    this.points = points;
    const n = points.length;
    // mean nearest-neighbor spacing
    let sum = 0;
    for (let i = 0; i < n; i++) {
      let d2min = Infinity;
      const p = points[i];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const q = points[j];
        const d2 = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
        if (d2 < d2min) d2min = d2;
      }
      sum += Math.sqrt(d2min);
    }
    this.s = sum / n;
    this.sigma = sigmaScale * this.s;
    this.twoSig2 = 2 * this.sigma ** 2;
    this.grid = gridScale * this.s;
    this.r2 = points.reduce((a, p) => a + p[0] ** 2 + p[1] ** 2, 0) / n;
  }

  // The small-angle closed form: each point's nearest is itself, and
  // rotation displaces it by r·θ — the gaussian cloud law.
  cloudLaw(thetaDeg) {
    const th = thetaDeg * Math.PI / 180;
    return Math.exp(-this.r2 * th * th / this.twoSig2);
  }

  // twist-engine's instrument, verbatim semantics.
  registration(thetaDeg) {
    const th = thetaDeg * Math.PI / 180;
    const c = Math.cos(th), si = Math.sin(th);
    const grid = this.grid, hash = new Map();
    const key = (x, y) => `${Math.floor(x / grid)},${Math.floor(y / grid)}`;
    for (const p of this.points) {
      const k = key(p[0], p[1]);
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k).push(p);
    }
    const cell = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let sum = 0;
    const n = this.points.length;
    for (const [x, y] of this.points) {
      const px = x * c - y * si, py = x * si + y * c;
      let best = Infinity;
      const cx = Math.floor(px / grid), cy = Math.floor(py / grid);
      for (const [dx, dy] of cell) {
        const bucket = hash.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const q of bucket) {
          const d2 = (px - q[0]) ** 2 + (py - q[1]) ** 2;
          if (d2 < best) best = d2;
        }
      }
      sum += Math.exp(-best / this.twoSig2);
    }
    return sum / n;
  }

  curve(fromDeg, toDeg, stepDeg) {
    const out = [];
    for (let a = fromDeg; a <= toDeg + 1e-12; a += stepDeg) {
      out.push({ theta: a, R: this.registration(a) });
    }
    return out;
  }
}

// Seat the instrument on the floor: tiling vertices (face centers) inside
// a core disk — the twist regime's viewport.
export function twistFieldFrom(multigrid, radius) {
  const pts = multigrid.faces()
    .filter(f => Math.hypot(f.x, f.y) < radius)
    .map(f => [f.x, f.y]);
  return new TwistField(pts);
}
