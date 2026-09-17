// Locational address — the lift as the holographic code.
//
// The multigrid arrangement IS an interference pattern: N families of
// parallel lines are N phase gratings, and every point of the plane is
// demodulated by them into an integer vector
//
//   j(p) = ( ⌊n₀·p − γ₀⌉, …, ⌊n_{N-1}·p − γ_{N-1}⌉ )  ∈ Z^N
//
// with the crystal's own tieFloor discipline. The 2D location does not
// merely sit in the tiling — it encodes its full N-dimensional preimage
// (docs/THE-FLOOR.md §9). Retrieval is O(N) floor operations: no search,
// no index; the geometry is the index.
//
// Two honest pins bound the map (tests/nscaling.test.mjs):
//   • INTERIOR: quantize(p) = the bordering face's lift for any p taken
//     a hair off a segment toward its side-face — 7670/7670 in probe.
//     This is constructional truth (face index = floor of the phase).
//   • ONE-EDGE SEEK: the strip-center K(j) may sit a hair OUTSIDE face j
//     (de Bruijn's least-squares point is not an interior guarantee —
//     2057/3069 empirically) — but quantize(K(j)) always lands within
//     exactly one dual-edge length of K(j) (max 0.400000 = 2/N, probe).
//     A lookup by geometry never misses by more than one edge.

export class LocAddress {
  constructor(multigrid) {
    this.mg = multigrid;
  }

  // Phase demodulation: the face index vector containing point p.
  // tieFloor mirrors the multigrid's own tie discipline (multigrid.mjs).
  liftAt(x, y) {
    const { N, normals, gamma } = this.mg;
    const j = new Array(N);
    for (let k = 0; k < N; k++) {
      const v = normals[k][0] * x + normals[k][1] * y - gamma[k];
      j[k] = Math.floor(v + 1e-9);
    }
    return j;
  }

  // The strip-center position of a lift — the same formula the faces use.
  positionOf(j) {
    const { N, normals, gamma } = this.mg;
    let x = 0, y = 0;
    for (let k = 0; k < N; k++) {
      const w = j[k] + gamma[k] + 0.5;
      x += w * normals[k][0];
      y += w * normals[k][1];
    }
    return [x * 2 / N, y * 2 / N];
  }

  key(j) { return j.join(','); }

  // An interior point of the face with the given lift — found by scanning
  // arrangement segments for one bordering the face, then stepping a hair
  // from its midpoint toward the face's side. Constructional: quantize of
  // the returned point IS the face (probe: 7670/7670).
  interiorPointOf(lift) {
    if (!this._interior) {
      this._interior = new Map();
      const { normals, gamma } = this.mg;
      for (const s of this.mg.arrangementSegments()) {
        const n = normals[s.k];
        const d = [-n[1], n[0]];
        const mid = [(s.j + gamma[s.k]) * n[0] + (s.t1 + s.t2) / 2 * d[0],
                     (s.j + gamma[s.k]) * n[1] + (s.t1 + s.t2) / 2 * d[1]];
        for (const [face, sign] of [[s.above, 1], [s.below, -1]]) {
          const key = face.join(',');
          if (this._interior.has(key)) continue;
          this._interior.set(key, [mid[0] + sign * 1e-4 * n[0], mid[1] + sign * 1e-4 * n[1]]);
        }
      }
    }
    return this._interior.get(this.key(lift));
  }
}

// Content-addressed memory on the crystal: write by lift, read by location.
export class LocStore {
  constructor(multigrid) {
    this.addr = new LocAddress(multigrid);
    this.map = new Map();
  }

  set(lift, value) { this.map.set(this.addr.key(lift), value); return this; }

  // Any point in the plane resolves through the interference pattern to
  // the lift that holds its payload — O(N), no scanning.
  get(x, y) { return this.map.get(this.addr.key(this.addr.liftAt(x, y))); }

  has(x, y) { return this.map.has(this.addr.key(this.addr.liftAt(x, y))); }

  get size() { return this.map.size; }
}
