"""
lattice_engine.py — Lane AH³ fused lattice kernel.

Autograd where the value/grad tensor lives ON a quilt cell grid:
a 2D integer (k, s) lattice. Identity is never a float — every number is a
q16 exact rational (num:int64, den:int64), the ℚ×10⁶ fixed-point codec.
Floats may only touch display.

Neighbor relations on the grid ARE the broadcast graph: a cell op reads its
4-neighborhood (its parent cells) and writes value+grad to itself.
Backprop is a Gauss-Seidel relaxation sweep over the grid — NOT a
topological recursion — so cycles in the graph are legal.

Semantic ops: QAdd, QMul, Commensurate(a, b), Twist(value, K).
Answers Karpathy's 3 questions (see demos.py):
  Q1  Where do my numbers live?        -> topology-aware gradient regions
  Q2  Are these two gradients commensurate? -> exact comb, not float epsilon
  Q3  What did that backward pass cost in fuel? -> deterministic fuel receipt

References: karpathy/micrograd (engine.py untouched alongside);
the quilt-studio lattice substrate; twist-engine commensuration comb.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from math import gcd
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# q16 codec — ℚ×10⁶ fixed-point. Identity is a pair of int64s. Never a float.
# ---------------------------------------------------------------------------

SCALE = 10 ** 6  # the quilt's metric: commensuration is judged against 10^6


class Q16:
    """Exact rational as (num, den) with den > 0, reduced by gcd.

    The pair of integers IS the identity. `.to_float()` is a display
    projection only — it is never fed back into the lattice.
    """

    __slots__ = ("num", "den")

    def __init__(self, num: int, den: int = 1):
        if den == 0:
            raise ZeroDivisionError("q16: zero denominator")
        if den < 0:
            num, den = -num, -den
        g = gcd(abs(num), den)
        self.num = num // g
        self.den = den // g

    # -- exact arithmetic ---------------------------------------------------
    def __add__(self, o: "Q16") -> "Q16":
        return Q16(self.num * o.den + o.num * self.den, self.den * o.den)

    def __sub__(self, o: "Q16") -> "Q16":
        return Q16(self.num * o.den - o.num * self.den, self.den * o.den)

    def __mul__(self, o: "Q16") -> "Q16":
        return Q16(self.num * o.num, self.den * o.den)

    def __neg__(self) -> "Q16":
        return Q16(-self.num, self.den)

    def __eq__(self, o) -> bool:
        if not isinstance(o, Q16):
            return NotImplemented
        return self.num == o.num and self.den == o.den

    def __hash__(self) -> int:
        return hash((self.num, self.den))

    def __repr__(self) -> str:
        return f"Q16({self.num}/{self.den})"

    def __str__(self) -> str:
        return f"{self.num}/{self.den}"

    @staticmethod
    def zero() -> "Q16":
        return Q16(0, 1)

    @staticmethod
    def one() -> "Q16":
        return Q16(1, 1)

    @staticmethod
    def from_int(n: int) -> "Q16":
        return Q16(n, 1)

    def to_float(self) -> float:
        """DISPLAY ONLY. Never an identity."""
        return self.num / self.den

    def is_zero(self) -> bool:
        return self.num == 0


ZERO = Q16.zero()
ONE = Q16.one()


def commensurate(a: Q16, b: Q16) -> bool:
    """Exact commensuration predicate — the comb answer, not float epsilon.

    Two q16 values are commensurate iff their ratio a/b, reduced to lowest
    terms p/q, has q | 10^6: they share the decimal metric of the quilt.
    (1/3)*3 vs 1  -> ratio 1/1  -> TRUE   (floats say 0.999... != 1)
    1/3     vs 1  -> ratio 1/3  -> FALSE  (ternary ghost on a decimal quilt)
    """
    if b.is_zero():
        return False
    r = a / b  # exact rational ratio
    return r.den != 0 and (SCALE % r.den == 0)


def _q16_div(self: Q16, o: "Q16") -> "Q16":
    if o.is_zero():
        raise ZeroDivisionError("q16: division by zero")
    return Q16(self.num * o.den, self.den * o.num)


Q16.__truediv__ = _q16_div  # ratio is exact; result stays in the codec


def abs_diff(a: Q16, b: Q16) -> Q16:
    """Exact |a − b| in the codec."""
    d = a - b
    return Q16(-d.num, d.den) if d.num < 0 else d


def max_q(a: Q16, b: Q16) -> Q16:
    """Exact max on the rational line: compare cross-products."""
    lhs = a.num * b.den
    rhs = b.num * a.den
    return a if lhs >= rhs else b


def q_leq(a: Q16, b: Q16) -> bool:
    """Exact a ≤ b."""
    return a.num * b.den <= b.num * a.den


# ---------------------------------------------------------------------------
# Lattice cells — the value/grad tensor lives ON the grid.
# ---------------------------------------------------------------------------

@dataclass
class Cell:
    """One quilt cell at integer lattice coordinate (k, s).

    Holds exact-rational value + grad, the op that wrote it, and its parent
    neighborhood (the cells the op read — the broadcast graph's edges).
    """

    lattice: "Lattice"
    k: int
    s: int
    tag: str
    op: str                                   # LEAF | QADD | QMUL
    parents: Tuple["Cell", ...] = ()
    value: Q16 = field(default_factory=Q16.zero)
    grad: Q16 = field(default_factory=Q16.zero)
    _pushed: Q16 = field(default_factory=Q16.zero, repr=False)  # grad already swept out
    _const: Optional[Q16] = field(default=None, repr=False)   # folded constant, if any

    def __add__(self, o) -> "Cell":
        return self.lattice.qadd(self, self.lattice.coerce(o))

    def __mul__(self, o) -> "Cell":
        return self.lattice.qmul(self, self.lattice.coerce(o))

    def __radd__(self, o) -> "Cell":
        return self.lattice.qadd(self.lattice.coerce(o), self)

    def __rmul__(self, o) -> "Cell":
        return self.lattice.qmul(self.lattice.coerce(o), self)

    # -- display projections (never identity) --------------------------------
    def v(self) -> float:
        return self.value.to_float()

    def g(self) -> float:
        return self.grad.to_float()


# ---------------------------------------------------------------------------
# Fuel ledger — Q3. Per-op energy: mul/add counts × lattice-hop distance.
# ---------------------------------------------------------------------------

@dataclass
class FuelReceipt:
    """Deterministic energy receipt for a backward pass."""

    fwd_adds: int = 0
    fwd_muls: int = 0
    grad_adds: int = 0
    grad_muls: int = 0
    sweeps: int = 0
    hop_cost: int = 0
    cells_touched: int = 0
    residual: "Q16 | None" = None  # exact residual at termination (None for pure forward)

    def canonical(self) -> str:
        return (
            f"fuel|fwd_adds={self.fwd_adds}|fwd_muls={self.fwd_muls}"
            f"|grad_adds={self.grad_adds}|grad_muls={self.grad_muls}"
            f"|sweeps={self.sweeps}|hop_cost={self.hop_cost}"
            f"|cells_touched={self.cells_touched}"
            f"|residual={self.residual}"
        )

    def hash(self) -> str:
        return hashlib.sha256(self.canonical().encode()).hexdigest()[:16]

    def render(self) -> str:
        return (
            "FUEL RECEIPT\n"
            "  forward : {fa} adds, {fm} muls\n"
            "  backward: {ga} adds, {gm} muls over {sw} relaxation sweep(s)\n"
            "  lattice : {hc} hop-units across {ct} cell(s)\n"
            "  receipt : {h}"
        ).format(
            fa=self.fwd_adds, fm=self.fwd_muls,
            ga=self.grad_adds, gm=self.grad_muls, sw=self.sweeps,
            hc=self.hop_cost, ct=self.cells_touched, h=self.hash(),
        ) + (f"\n  residual  : {self.residual}" if self.residual is not None else "")


# ---------------------------------------------------------------------------
# The Lattice — substrate. Cells, op placement, relaxation backprop.
# ---------------------------------------------------------------------------

class Lattice:
    """A quilt cell grid. Cells are placed deterministically: an op cell
    sits one layer downstream of its deepest parent (k = max(parent.k)+1),
    at the next free s-slot in that layer. The neighbor relation IS the
    broadcast graph: an op reads its parent cells, writes to itself.
    """

    def __init__(self):
        self.cells: List[Cell] = []
        self._layer_next_s: Dict[int, int] = {}
        self.fuel = FuelReceipt()

    # -- construction --------------------------------------------------------
    def _place(self, k: int, tag: str, op: str, parents: Tuple[Cell, ...],
               const: Optional[Q16] = None) -> Cell:
        s = self._layer_next_s.get(k, 0)
        self._layer_next_s[k] = s + 1
        c = Cell(self, k, s, tag, op, parents, _const=const)
        self.cells.append(c)
        return c

    def scalar(self, num: int, den: int = 1, tag: Optional[str] = None) -> Cell:
        """Leaf cell holding an exact rational constant."""
        q = Q16(num, den)
        c = self._place(0, tag or f"leaf[{q}]", "LEAF", (), const=q)
        c.value = q
        return c

    def parameter(self, num: int, den: int = 1, tag: Optional[str] = None) -> Cell:
        """Leaf cell whose value will be written by forward evaluation
        (an input port). Initial value is the given exact rational."""
        return self.scalar(num, den, tag=tag)

    def placeholder(self, tag: str = "?") -> Cell:
        """An op cell with no parents yet — created so a LATER rewire can
        close a cycle. Value starts at 0/1. Cycles are legal on the lattice:
        relaxation, not topology, is the scheduler."""
        return self._place(0, tag, "QMUL", ())

    def rewire(self, cell: Cell, op: str, parents: Tuple[Cell, ...]) -> None:
        """Close a cycle: set an op cell's parents after construction.
        Only legal before evaluation; the parents must already exist."""
        if op not in ("QADD", "QMUL"):
            raise ValueError(f"rewire: unknown op {op!r}")
        if not parents:
            raise ValueError("rewire: need ≥1 parent to close a cycle")
        cell.op = op
        cell.parents = parents
        cell.tag = f"cyc[{cell.tag}]" if not cell.tag.startswith("cyc[") else cell.tag
        # placement: one layer downstream of the deepest NEW parent, unless
        # that would orphan the cell's existing children — for cyclic cells
        # the k-axis is descriptive, not a schedule (relaxation is).
        if parents:
            cell.k = min(cell.k, max(p.k for p in parents) + 1)

    def coerce(self, o) -> Cell:
        if isinstance(o, Cell):
            return o
        if isinstance(o, Q16):
            return self.scalar(o.num, o.den, tag=f"const[{o}]")
        if isinstance(o, int):
            return self.scalar(o, 1, tag=f"const[{o}]")
        raise TypeError(f"lattice cannot host {type(o)!r} — floats are display-only")

    # -- semantic ops ---------------------------------------------------------
    def qadd(self, a: Cell, b: Cell) -> Cell:
        k = max(a.k, b.k) + 1
        hop = self._hop(k, a) + self._hop(k, b)
        c = self._place(k, f"({a.tag}+{b.tag})", "QADD", (a, b))
        self.fuel.fwd_adds += 1
        self.fuel.hop_cost += hop
        return c

    def qmul(self, a: Cell, b: Cell) -> Cell:
        k = max(a.k, b.k) + 1
        hop = self._hop(k, a) + self._hop(k, b)
        c = self._place(k, f"({a.tag}*{b.tag})", "QMUL", (a, b))
        self.fuel.fwd_muls += 1
        self.fuel.hop_cost += hop
        return c

    @staticmethod
    def _hop(child_k: int, parent: Cell) -> int:
        return abs(child_k - parent.k)  # lattice-hop distance (k-axis; s unique per layer)

    # -- forward evaluation: relaxation sweep (cycles legal) -------------------
    def evaluate(self, max_sweeps: int = 10_000,
                 resolution: Q16 = None) -> None:
        """Gauss-Seidel relaxation on values. Op cells recompute from their
        parent neighborhood until no cell's value changes by more than the
        resolution (default: exact zero — full exactness on DAG-legal graphs).
        Cycles are legal: they terminate at the resolution floor."""
        if resolution is None:
            resolution = Q16(0, 1)
        for _ in range(max_sweeps):
            moved = False
            for c in self.cells:
                if c.op == "LEAF":
                    continue
                new = self._combine(c)
                if not q_leq(abs_diff(new, c.value), resolution):
                    c.value = new
                    moved = True
            if not moved:
                return
        raise RuntimeError("lattice.evaluate: no convergence in %d sweeps" % max_sweeps)

    @staticmethod
    def _combine(c: Cell) -> Q16:
        a, b = c.parents
        if c.op == "QADD":
            return a.value + b.value
        if c.op == "QMUL":
            return a.value * b.value
        return c.value

    # -- backward: relaxation sweep, NOT topological recursion -----------------
    def backward(self, seed: Cell, max_sweeps: int = 10_000,
                 resolution: Q16 = None) -> FuelReceipt:
        """Seed grad = 1, then Gauss-Seidel delta sweeps until the largest
        per-sweep grad delta is ≤ resolution (default exact zero — DAG-legal
        graphs terminate exactly; cyclic graphs terminate at the resolution
        floor, disclosed as the exact residual on the receipt).
        Cycles are legal: a cell's grad reaches equilibrium like heat."""
        if resolution is None:
            resolution = Q16(0, 1)
        self.evaluate(resolution=resolution)
        self.fuel.residual = None
        for c in self.cells:
            c.grad = Q16.zero()
            c._pushed = Q16.zero()
        seed.grad = ONE
        sweeps = 0
        while sweeps < max_sweeps:
            sweeps += 1
            moved = False
            max_delta = Q16.zero()
            # Gauss-Seidel order: deterministic by (k, s)
            for c in sorted(self.cells, key=lambda x: (x.k, x.s)):
                delta = c.grad - c._pushed
                if not q_leq(abs_diff(delta, Q16.zero()), resolution):
                    max_delta = max_q(abs_diff(delta, Q16.zero()), max_delta)
                    c._pushed = c.grad
                    moved = True
                    for p in c.parents:
                        if c.op == "QADD":
                            p.grad = p.grad + delta
                            self.fuel.grad_adds += 1
                        elif c.op == "QMUL":
                            other = c.parents[1] if p is c.parents[0] else c.parents[0]
                            p.grad = p.grad + delta * other.value
                            self.fuel.grad_muls += 1
                            self.fuel.grad_adds += 1
            if not moved:
                self.fuel.residual = Q16.zero()
                break
        else:
            raise RuntimeError("lattice.backward: no convergence in %d sweeps" % max_sweeps)
        if self.fuel.residual is None:
            self.fuel.residual = max_delta
        self.fuel.sweeps = sweeps
        self.fuel.cells_touched = sum(1 for c in self.cells if not c.grad.is_zero() or c is seed)
        return self.fuel

    # -- Q1: where do my numbers live? -----------------------------------------
    def region_of(self, cell: Cell) -> Dict[str, Tuple[int, int, int, int]]:
        """Topology report: the lattice region a cell's forward value and
        backward gradient inhabit — the cells they flowed through."""
        seen: set = set()

        def walk(c: Cell) -> List[Cell]:
            if id(c) in seen:
                return []
            seen.add(id(c))
            out = [c]
            for p in c.parents:
                out.extend(walk(p))
            return out

        span = walk(cell)
        val_cells = span
        grad_cells = [c for c in span if not c.grad.is_zero()]

        def box(cs: List[Cell]) -> Optional[Tuple[int, int, int, int]]:
            if not cs:
                return None
            ks = [c.k for c in cs]
            ss = [c.s for c in cs]
            return (min(ks), min(ss), max(ks), max(ss))

        return {"value_region": box(val_cells), "grad_region": box(grad_cells)}

    def describe_gradient(self, cell: Cell) -> str:
        """Q1 answer, printable: the grid region this gradient inhabits."""
        r = self.region_of(cell)
        (k0, s0, k1, s1) = r["grad_region"] or (-1, -1, -1, -1)
        cells = [c for c in self.cells if not c.grad.is_zero()]
        lines = [
            f"gradient of '{cell.tag}' inhabits lattice region k∈[{k0},{k1}] s∈[{s0},{s1}]",
            f"  {len(cells)} cell(s) carry non-zero grad:",
        ]
        for c in sorted(cells, key=lambda x: (x.k, x.s)):
            lines.append(f"    ({c.k:2d},{c.s:2d})  {c.tag:32s}  grad = {c.grad}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Twist — the twist-law on the lattice: A ↦ A△K, S = 1 − R.
# ---------------------------------------------------------------------------

def twist(cell: Cell, K: int) -> Cell:
    """Twist a cell by integer key K.

    Coordinate law (exact, identity-safe): k ↦ k △ K  (bitwise xor on the
    integer lattice axis). Value law: R ↦ 1 − R, pairing each cell with its
    shadow S = 1 − R. The twist is an involution: twist(twist(A,K),K) = A.
    """
    if K < 0:
        raise ValueError("twist key must be a non-negative integer")
    lat = cell.lattice
    tk = cell.k ^ K
    s = lat._layer_next_s.get(tk, 0)
    lat._layer_next_s[tk] = s + 1
    out = Cell(lat, tk, s, f"twist[{cell.tag},{K}]", "TWIST", (cell,))
    out.value = Q16(cell.value.den - cell.value.num, cell.value.den)  # R ↦ 1−R
    out.grad = Q16(cell.grad.den - cell.grad.num, cell.grad.den)      # S = 1−R
    lat.cells.append(out)
    return out


__all__ = [
    "SCALE", "Q16", "ZERO", "ONE", "commensurate", "Cell", "FuelReceipt",
    "Lattice", "twist",
]
