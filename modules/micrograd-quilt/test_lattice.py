"""
test_lattice.py — Lane AH³ test suite.

Covers: q16 codec exactness, lattice kernel correctness (gradient equivalence
vs micrograd on DAG-legal graphs, honest float-disclosure elsewhere),
relaxation-sweep convergence on a cyclic graph, semantic op exactness,
fuel-receipt determinism. Baseline micrograd suite must stay green
(engine.py / nn.py untouched — the kernel is a NEW substrate alongside).
"""

import hashlib

import pytest

from lattice_engine import (
    Q16, Lattice, commensurate, twist, abs_diff,
)
from micrograd.engine import Value


# ---------------------------------------------------------------------------
# q16 codec
# ---------------------------------------------------------------------------

class TestQ16:
    def test_reduction(self):
        assert Q16(2, 4) == Q16(1, 2)

    def test_add_exact(self):
        assert Q16(1, 3) + Q16(1, 6) == Q16(1, 2)

    def test_mul_exact(self):
        assert Q16(1, 3) * Q16(3, 1) == Q16(1, 1)

    def test_sub_exact(self):
        assert Q16(3, 2) - Q16(1, 2) == Q16(1, 1)

    def test_div_exact(self):
        assert Q16(1, 2) / Q16(1, 4) == Q16(2, 1)

    def test_zero_den_raises(self):
        with pytest.raises(ZeroDivisionError):
            Q16(1, 0)

    def test_div_by_zero_raises(self):
        with pytest.raises(ZeroDivisionError):
            Q16(1, 1) / Q16(0, 1)

    def test_identity_is_ints_not_float(self):
        q = Q16(1, 3)
        assert isinstance(q.num, int) and isinstance(q.den, int)
        # display projection never mutates identity
        _ = q.to_float()
        assert (q.num, q.den) == (1, 3)

    def test_third_times_three_is_one_exactly(self):
        assert Q16(1, 3) * Q16(3, 1) == Q16(1, 1)

    def test_float_crack_disclosed(self):
        # floats: 0.1+0.2 != 0.3 ; exact codec: 3/10
        assert Q16(1, 10) + Q16(2, 10) == Q16(3, 10)


# ---------------------------------------------------------------------------
# semantic ops: commensurate + twist
# ---------------------------------------------------------------------------

class TestSemanticOps:
    def test_commensurate_rebuilt_third(self):
        assert commensurate(Q16(1, 3) * Q16(3, 1), Q16(1, 1)) is True

    def test_commensurate_third_vs_one_false(self):
        # ternary ghost on a decimal quilt
        assert commensurate(Q16(1, 3), Q16(1, 1)) is False

    def test_commensurate_tenths(self):
        assert commensurate(Q16(1, 10) + Q16(2, 10), Q16(3, 10)) is True

    def test_commensurate_zero_den(self):
        assert commensurate(Q16(1, 1), Q16(0, 1)) is False

    def test_commensurate_ratio_reduce(self):
        # 2/4 vs 1/2 -> ratio 1/1
        assert commensurate(Q16(2, 4), Q16(1, 2)) is True

    def test_twist_coordinate_xor(self):
        lat = Lattice()
        a = lat.scalar(1, 4, tag="a")     # R = 1/4
        t = twist(a, 7)
        assert t.k == (a.k ^ 7)
        assert t.value == Q16(3, 4)       # R ↦ 1−R

    def test_twist_involution(self):
        lat = Lattice()
        a = lat.scalar(1, 4, tag="a")
        t2 = twist(twist(a, 5), 5)
        assert t2.value == a.value        # twist² = identity

    def test_twist_shadow_pairs_to_one(self):
        lat = Lattice()
        a = lat.scalar(1, 4, tag="a")
        t = twist(a, 3)
        assert t.value + a.value == Q16(1, 1)   # R + S = 1


# ---------------------------------------------------------------------------
# lattice kernel: correctness vs micrograd (DAG-legal)
# ---------------------------------------------------------------------------

def _micrograd_grads(fn, inputs):
    vals = [Value(n / d) for (n, d) in inputs]
    out = fn(*vals)
    out.backward()
    return [v.grad for v in vals], out.data


def _lattice_grads(fn, inputs):
    lat = Lattice()
    cells = [lat.parameter(n, d) for (n, d) in inputs]
    out = fn(*cells)
    lat.backward(out)
    return [c.grad for c in cells], out.value


def _close(q, f, tol=1e-9):
    return abs(q.to_float() - f) < tol


class TestLatticeVsMicrograd:
    @pytest.mark.parametrize("inputs", [
        [(1, 2), (1, 3)],
        [(2, 1), (3, 1)],
        [(3, 2), (2, 5)],
        [(7, 3), (5, 4)],
    ])
    def test_add_mul_chain(self, inputs):
        def f(a, b):
            return (a * b) + a + b
        mg_grads, mg_out = _micrograd_grads(f, inputs)
        lt_grads, lt_out = _lattice_grads(f, inputs)
        assert _close(lt_out, mg_out)
        for lg, mg in zip(lt_grads, mg_grads):
            assert _close(lg, mg), f"{lg} vs {mg}"

    @pytest.mark.parametrize("inputs", [
        [(1, 2), (1, 3), (3, 2)],
        [(2, 1), (3, 1), (4, 1)],
    ])
    def test_poly(self, inputs):
        def f(a, b, c):
            return (a * b) + (a * c) + (b * c)
        mg_grads, mg_out = _micrograd_grads(f, inputs)
        lt_grads, lt_out = _lattice_grads(f, inputs)
        assert _close(lt_out, mg_out)
        for lg, mg in zip(lt_grads, mg_grads):
            assert _close(lg, mg), f"{lg} vs {mg}"

    def test_exact_where_commensurate(self):
        # DAG with denominators dividing 10^6: lattice grad is the exact
        # rational micrograd only approximates in binary64.
        lat = Lattice()
        x = lat.parameter(1, 2)
        y = lat.parameter(1, 5)
        z = (x * y) + x
        lat.backward(z)
        assert x.grad == Q16(6, 5)   # exact: dz/dx = y+1 = 1/5+1 = 6/5
        assert y.grad == Q16(1, 2)

    def test_float_disclosure_elsewhere(self):
        # 1/3 never becomes a float identity; display projection disclosed.
        lat = Lattice()
        x = lat.parameter(1, 3)
        y = x * lat.scalar(3, 1)
        lat.backward(y)
        assert x.grad == Q16(3, 1)         # exact rational, not 2.9999996
        assert abs(x.grad.to_float() - 3.0) < 1e-12  # display agrees


# ---------------------------------------------------------------------------
# relaxation: cyclic graph convergence (Q1-cycles legal)
# ---------------------------------------------------------------------------

class TestCyclicRelaxation:
    def test_forward_cycle_converges_at_resolution(self):
        # p = q/2 + 1, q = p/2  →  p=4/3, y=2/3 (attractor)
        RES = Q16(1, 10 ** 6)
        lat = Lattice()
        x = lat.scalar(1, 2, tag="x")
        c = lat.scalar(1, 1, tag="c")
        p = lat.placeholder(tag="p")
        q = lat.placeholder(tag="q")
        w = lat.qmul(q, x)                    # w = q/2
        lat.rewire(q, "QMUL", (p, x))         # q = p/2
        lat.rewire(p, "QADD", (w, c))         # p = q/2 + 1 — cycle closed
        lat.evaluate(resolution=RES)
        assert abs(p.value.to_float() - 4 / 3) < 2e-6
        assert abs(q.value.to_float() - 2 / 3) < 2e-6

    def test_backward_cycle_converges(self):
        # TRUE cyclic graph: p = q*x, q = p + c, x=1/2, c=1.
        #   forward:  p = (p+1)/2        → p=1, q=2
        #   backward: grad_p = 1 + grad_q ; grad_q = x·grad_p
        #             → grad_p = 2, grad_q = 1  (contraction |x|<1)
        RES = Q16(1, 10 ** 9)
        lat = Lattice()
        x = lat.scalar(1, 2, tag="x")
        c = lat.scalar(1, 1, tag="c")
        p = lat.placeholder(tag="p")
        q = lat.qadd(p, c)                    # q = p + c
        lat.rewire(p, "QMUL", (q, x))         # p = q*x  — cycle closed
        receipt = lat.backward(p, resolution=RES, max_sweeps=500)
        # forward values relaxed to the attractor
        assert abs(p.value.to_float() - 1.0) < 2e-6
        assert abs(q.value.to_float() - 2.0) < 2e-6
        # backward gradients relaxed to the exact solution
        assert abs(p.grad.to_float() - 2.0) < 2e-6
        assert abs(q.grad.to_float() - 1.0) < 2e-6
        # grad_x = grad_p * q = 2*2 = 4 (analytic: dp/dx = q/(1−x) = 4)
        assert abs(x.grad.to_float() - 4.0) < 2e-6
        # honest disclosure: cyclic graphs terminate at the resolution floor
        assert receipt.residual is not None
        assert abs_diff(receipt.residual, Q16(0, 1)).to_float() <= 1e-9 + 1e-15
        assert receipt.sweeps < 500


# ---------------------------------------------------------------------------
# Q1: topology-aware tensors
# ---------------------------------------------------------------------------

class TestTopology:
    def test_gradient_region_bbox(self):
        lat = Lattice()
        x = lat.parameter(2, 1, tag="x")
        y = lat.parameter(3, 1, tag="y")
        z = (x * y) + (x + y)
        lat.backward(z)
        r = lat.region_of(z)
        assert r["grad_region"] == (0, 0, 2, 1)

    def test_describe_lists_cells(self):
        lat = Lattice()
        x = lat.parameter(2, 1, tag="x")
        y = lat.parameter(3, 1, tag="y")
        z = (x * y) + (x + y)
        lat.backward(z)
        text = lat.describe_gradient(z)
        assert "k∈[0,2]" in text and "grad = 4/1" in text and "grad = 3/1" in text

    def test_grid_placement_deterministic(self):
        lat = Lattice()
        a = lat.parameter(1, 1)
        b = lat.parameter(1, 1)
        c = a * b
        d = a + b
        assert (c.k, d.k) == (1, 1)
        assert {c.s, d.s} == {0, 1}


# ---------------------------------------------------------------------------
# Q3: fuel receipt determinism
# ---------------------------------------------------------------------------

def _build_fuel():
    lat = Lattice()
    a = lat.parameter(1, 2, tag="a")
    b = lat.parameter(1, 3, tag="b")
    c = lat.parameter(3, 2, tag="c")
    out = (a * b) + (a * c) + (b * c)
    return lat.backward(out)


class TestFuel:
    def test_receipt_deterministic(self):
        r1, r2 = _build_fuel(), _build_fuel()
        assert r1.hash() == r2.hash()
        assert r1.canonical() == r2.canonical()

    def test_receipt_hash_stable_value(self):
        r1 = _build_fuel()
        # structural hash: same graph → same sha prefix; assert stability
        # by recomputing from canonical, not by hardcoding an arbitrary hex.
        expect = hashlib.sha256(r1.canonical().encode()).hexdigest()[:16]
        assert r1.hash() == expect

    def test_counts_match_ops(self):
        r = _build_fuel()
        assert r.fwd_adds == 2       # two adds
        assert r.fwd_muls == 3       # three muls
        assert r.sweeps >= 2
        assert r.hop_cost > 0
        assert r.residual == Q16(0, 1)   # DAG: exact termination


# ---------------------------------------------------------------------------
# invariants: identity never floats; lattice cells exact
# ---------------------------------------------------------------------------

class TestInvariants:
    def test_no_float_stored_on_cells(self):
        lat = Lattice()
        x = lat.parameter(1, 3)
        y = x * lat.scalar(3, 1)
        lat.backward(y)
        for c in lat.cells:
            assert isinstance(c.value, Q16)
            assert isinstance(c.grad, Q16)

    def test_cell_ops_only_semantic(self):
        lat = Lattice()
        a = lat.parameter(1, 2)
        b = lat.parameter(3, 4)
        c = a + b
        d = a * b
        lat.evaluate()
        assert c.value == Q16(5, 4)
        assert d.value == Q16(3, 8)

    def test_dag_exact_zero_residual(self):
        lat = Lattice()
        x = lat.parameter(2, 1)
        y = (x * x) + x
        receipt = lat.backward(y)
        assert receipt.residual == Q16(0, 1)
        assert x.grad == Q16(5, 1)
