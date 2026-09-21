"""
demos.py — Karpathy's 3 questions, asked and answered by the lattice kernel.

micrograd structurally cannot ask these; the fused lattice kernel answers
each with a runnable demo. Run:  python3 demos.py
"""

from lattice_engine import Lattice, Q16, commensurate, twist


def demo_q1_where_do_numbers_live():
    """Q1: Where do my numbers live?

    In micrograd a gradient is an anonymous float in a ._backward closure.
    On the lattice, a gradient inhabits a REGION of the (k,s) grid — it has
    topology. We can print the region and read it.
    """
    print("=" * 72)
    print("Q1  WHERE DO MY NUMBERS LIVE?")
    print("=" * 72)
    lat = Lattice()
    x = lat.parameter(2, 1, tag="x")
    y = lat.parameter(3, 1, tag="y")
    z = (x * y) + (x + y)          # z = xy + (x+y)
    lat.backward(z)
    print(f"graph: z = x*y + (x+y),  x=2, y=3 → z = {z.v()}")
    print(lat.describe_gradient(z))
    print()


def demo_q2_commensurate():
    """Q2: Are these two gradients commensurate?

    Floats answer with epsilon — 0.9999999999999999 'equals' 1 if you
    squint. The comb answers exactly: (1/3)*3 vs 1 is TRUE because the
    ratio reduces to 1/1 (denominator divides 10^6). 1/3 vs 1 is FALSE —
    a ternary ghost on a decimal quilt.
    """
    print("=" * 72)
    print("Q2  ARE THESE TWO GRADIENTS COMMENSURATE?")
    print("=" * 72)
    lat = Lattice()
    third = lat.scalar(1, 3, tag="1/3")
    one = lat.scalar(1, 1, tag="1")
    rebuilt = third * lat.scalar(3, 1, tag="3")   # (1/3)*3 exactly
    lat.evaluate()
    print(f"floats      : (1/3)*3 == 1.0 ? {rebuilt.value.to_float() == 1.0}  "
          f"(double rounding hides the crack here)")
    print(f"floats      : 0.1+0.2 == 0.3   ? {0.1 + 0.2 == 0.3}  "
          f"(shows {0.1 + 0.2!r} vs {0.3!r})")
    tenth = Q16(1, 10)
    print(f"exact q16   : (1/3)*3 == 1     ? {rebuilt.value == one.value}")
    print(f"commensurate: ((1/3)*3, 1)     ? {commensurate(rebuilt.value, one.value)}")
    print(f"commensurate: (1/3, 1)         ? {commensurate(third.value, one.value)}")
    print(f"commensurate: (0.1+0.2, 0.3)   ? {commensurate(tenth + tenth + tenth, Q16(3, 10))}")
    print()


def demo_q3_fuel_receipt():
    """Q3: What did that backward pass cost in fuel?

    micrograd's backward() is silent about cost. The lattice keeps an energy
    ledger: every grad-mul and grad-add, every lattice hop, counted — and the
    receipt hash is deterministic: same graph, same fuel, bit for bit.
    """
    print("=" * 72)
    print("Q3  WHAT DID THAT BACKWARD PASS COST IN FUEL?")
    print("=" * 72)

    def build():
        lat = Lattice()
        a = lat.parameter(1, 2, tag="a")     # 1/2
        b = lat.parameter(1, 3, tag="b")     # 1/3
        c = lat.parameter(3, 2, tag="c")     # 3/2
        out = (a * b) + (a * c) + (b * c)
        receipt = lat.backward(out)
        return receipt

    r1 = build()
    r2 = build()
    print(f"graph: out = a*b + a*c + b*c  (all rationals)")
    print(r1.render())
    print()
    same_hash = r1.hash() == r2.hash()
    print(f"determinism: build-twice receipts identical ? {same_hash}  ({r1.hash()} vs {r2.hash()})")
    print()


if __name__ == "__main__":
    demo_q1_where_do_numbers_live()
    demo_q2_commensurate()
    demo_q3_fuel_receipt()
