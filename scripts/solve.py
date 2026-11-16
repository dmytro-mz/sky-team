"""Rough balance check: a perfect-information randomised planner plays every scenario (dev helper)."""

import copy
import random
import sys

from skyteam.game.engine import SEATS, Game, IllegalMove
from skyteam.game.scenarios import SCENARIOS


def legal_moves(g):
    out = []
    if g.pending_token:
        return [(g.pending_token["seat"], {"t": "token", "slot": s}) for s in g.token_slots()]
    for seat in SEATS:
        for d in g.dice[seat]:
            if g.turn != seat and not d["wild"]:
                continue
            for delta in [0] + ([-1, 1] if g.coffee else []):
                v = d["value"] + delta
                if not 1 <= v <= 6:
                    continue
                for sid, sl in g.slots.items():
                    if g.can_use(seat, d, sl, v) is None:
                        out.append((seat, {"t": "place", "die": d["id"], "slot": sid, "coffee": delta}))
    return out


def rollout(g, rng):
    r = g.round
    while not g.result and g.round == r and g.phase == "place":
        moves = legal_moves(g)
        rng.shuffle(moves)
        for seat, a in moves:
            try:
                g.apply(seat, a)
                break
            except IllegalMove:
                continue
        else:
            return
    return


def score(g):
    if g.result:
        return 1000 if g.result["won"] else -1000
    return (
        g.position * 6
        + g.gear * 4
        + g.flaps * 4
        + g.brakes * 3
        + g.ice_pairs * 3
        - sum(g.planes) * 5
        - abs(g.axis) * 3
        + g.coffee
        + g.kerosene * 1.2
        + g.interns.__len__() * -4
    )


def play(sid, seed, samples=150):
    rng = random.Random(seed)
    g = Game(sid, seed)
    while not g.result:
        if g.phase == "discuss":
            for s in SEATS:
                g.apply(s, {"t": "ready"})
            continue
        best, bs = None, -1e9
        for _ in range(samples):
            h = copy.deepcopy(g)
            h.rng = random.Random(rng.random())
            rollout(h, rng)
            sc = score(h)
            if sc > bs:
                best, bs = h, sc
        if best is None:
            break
        g = best
    return bool(g.result and g.result["won"])


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    for sc in SCENARIOS:
        w = sum(play(sc.id, s) for s in range(n))
        print(f"{sc.id:10s} {sc.level:7s} {w}/{n}", flush=True)
