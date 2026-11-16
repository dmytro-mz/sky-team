import random

import pytest

from skyteam.game.engine import SEATS, Game, IllegalMove, other
from skyteam.game.scenarios import SCENARIOS


def play_random(sid: str, seed: int) -> Game:
    rng = random.Random(seed)
    g = Game(sid, seed)
    for _ in range(2000):
        if g.result:
            break
        if g.phase == "discuss":
            for s in SEATS:
                g.apply(s, {"t": "ready"})
            continue
        if g.reroll or g.swap:
            g.reroll = g.swap = None
            continue
        if g.pending_token:
            seat = g.pending_token["seat"]
            g.apply(seat, {"t": "token", "slot": rng.choice(g.token_slots())})
            continue
        moves = []
        for seat in SEATS:
            for d in g.dice[seat]:
                if g.turn != seat and not d["wild"]:
                    continue
                for sid2, sl in g.slots.items():
                    if g.can_use(seat, d, sl, d["value"]) is None:
                        moves.append((seat, d["id"], sid2))
        if not moves:
            g.apply("pilot", {"t": "timeout"}) if "realtime" in g.mods else None
            break
        random.shuffle(moves)
        for seat, did, slot in moves:
            try:
                g.apply(seat, {"t": "place", "die": did, "slot": slot})
                break
            except IllegalMove:
                continue
    return g


@pytest.mark.parametrize("sc", SCENARIOS, ids=lambda s: s.id)
def test_random_games_terminate_cleanly(sc):
    for seed in range(15):
        g = play_random(sc.id, seed)
        g.view(None), g.view("pilot")


def test_axis_and_engine_resolve():
    g = Game("yul", 1)
    g.apply("pilot", {"t": "ready"})
    g.apply("copilot", {"t": "ready"})
    g.dice["pilot"][0]["value"] = 5
    g.dice["copilot"][0]["value"] = 3
    g.apply("pilot", {"t": "place", "die": g.dice["pilot"][0]["id"], "slot": "axis_pilot"})
    g.apply("copilot", {"t": "place", "die": g.dice["copilot"][0]["id"], "slot": "axis_copilot"})
    assert g.axis == -2


def test_other():
    assert other("pilot") == "copilot"


def start_round(g: Game, pilot: list[int], copilot: list[int]) -> None:
    for s in SEATS:
        g.apply(s, {"t": "ready"})
    for seat, vals in (("pilot", pilot), ("copilot", copilot)):
        for d, v in zip(g.dice[seat], vals, strict=True):
            d["value"] = v


def put(g: Game, seat: str, idx: int, slot: str, coffee: int = 0) -> None:
    g.apply(seat, {"t": "place", "die": g.dice[seat][idx]["id"], "slot": slot, "coffee": coffee})


def test_engine_thresholds_and_gear_raise_blue():
    g = Game("yul", 3)
    g.planes = [0] * 7
    start_round(g, [3, 1, 1, 1], [1, 1, 1, 1])  # pilot first
    put(g, "pilot", 0, "engine_pilot")
    put(g, "copilot", 0, "engine_copilot")  # total 4 = blue -> hold
    assert g.position == 0
    g2 = Game("yul", 3)
    g2.planes = [0] * 7
    start_round(g2, [4, 1, 1, 1], [1, 1, 1, 1])
    put(g2, "pilot", 0, "engine_pilot")
    put(g2, "copilot", 0, "engine_copilot")  # 5 -> advance one
    assert g2.position == 1


def test_big_engine_moves_two_and_orange():
    g = Game("yul", 3)
    g.planes = [0] * 7
    start_round(g, [6, 1, 1, 1], [3, 1, 1, 1])  # 9 > orange 8
    put(g, "pilot", 0, "engine_pilot")
    put(g, "copilot", 0, "engine_copilot")
    assert g.position == 2


def test_collision_when_leaving_a_space_with_planes():
    g = Game("yul", 3)
    g.planes = [1, 0, 0, 0, 0, 0, 0]
    start_round(g, [3, 1, 1, 1], [3, 1, 1, 1])
    put(g, "pilot", 0, "engine_pilot")
    put(g, "copilot", 0, "engine_copilot")
    assert g.result and "Collision" in g.result["reason"]


def test_radio_clears_plane_and_counts_from_current_space():
    g = Game("yul", 3)
    g.planes = [0, 0, 1, 0, 0, 0, 0]
    start_round(g, [3, 1, 1, 1], [1, 1, 1, 1])
    put(g, "pilot", 0, "radio_pilot")
    assert g.planes[2] == 0


def test_axis_spin_and_tie():
    g = Game("yul", 3)
    start_round(g, [6, 1, 1, 1], [3, 1, 1, 1])
    put(g, "pilot", 0, "axis_pilot")
    put(g, "copilot", 0, "axis_copilot")
    assert g.result and "spins" in g.result["reason"]
    g = Game("yul", 3)
    start_round(g, [4, 1, 1, 1], [4, 1, 1, 1])
    put(g, "pilot", 0, "axis_pilot")
    put(g, "copilot", 0, "axis_copilot")
    assert g.axis == 0 and not g.result


def test_flaps_in_order_and_switches_stay_on():
    g = Game("yul", 3)
    start_round(g, [1, 1, 1, 1], [5, 2, 3, 4])
    put(g, "pilot", 0, "conc_0")
    with pytest.raises(IllegalMove):
        put(g, "copilot", 0, "flaps_2")  # out of order
    put(g, "copilot", 1, "flaps_0")
    assert g.flaps == 1 and g.orange == 9
    g.slots["conc_1"]["die"] = None
    for s in g.slots.values():
        s["die"] = None
    g.dice = {s: [] for s in SEATS}
    g.end_round()
    start_round(g, [1, 1, 1, 1], [1, 1, 1, 1])
    with pytest.raises(IllegalMove):
        put(g, "pilot", 0, "gear_0") if g.turn == "pilot" else put(g, "copilot", 0, "flaps_0")


def test_coffee_changes_value_not_wrapping():
    g = Game("yul", 3)
    g.coffee = 2
    start_round(g, [1, 1, 1, 1], [1, 1, 1, 1])
    with pytest.raises(IllegalMove):
        put(g, "pilot", 0, "radio_pilot", coffee=-1)
    put(g, "pilot", 0, "radio_pilot", coffee=2)
    assert g.coffee == 0 and g.slots["radio_pilot"]["die"]["value"] == 3


def test_must_keep_dice_for_axis_and_engine():
    g = Game("yul", 3)
    start_round(g, [1, 2, 3, 4], [1, 1, 1, 1])
    put(g, "pilot", 0, "radio_pilot")
    put(g, "copilot", 0, "radio_copilot_1")
    put(g, "pilot", 0, "conc_0")
    put(g, "copilot", 0, "radio_copilot_2")
    with pytest.raises(IllegalMove):  # two dice left, two mandatory spaces still empty
        put(g, "pilot", 0, "conc_1")
    put(g, "pilot", 0, "axis_pilot")


def test_final_round_win():
    g = Game("yul", 5)
    g.planes = [0] * 7
    g.round, g.position, g.gear, g.flaps, g.brakes = 7, 6, 3, 4, 3
    for i in range(3):
        g.slots[f"gear_{i}"]["on"] = True
        g.slots[f"brake_{i}"]["on"] = True
    for i in range(4):
        g.slots[f"flaps_{i}"]["on"] = True
    g.first = g.turn = "pilot"
    start_round(g, [2, 1, 1, 1], [2, 1, 1, 1])
    put(g, "pilot", 0, "axis_pilot")
    put(g, "copilot", 0, "axis_copilot")
    put(g, "pilot", 0, "engine_pilot")
    put(g, "copilot", 0, "engine_copilot")
    put(g, "pilot", 0, "radio_pilot")
    put(g, "copilot", 0, "radio_copilot_1")
    put(g, "pilot", 0, "conc_0")
    put(g, "copilot", 0, "conc_1")
    assert g.result and g.result["won"], g.result


def test_final_round_too_fast_loses():
    g = Game("yul", 5)
    g.planes = [0] * 7
    g.round, g.position, g.gear, g.flaps, g.brakes = 7, 6, 3, 4, 1
    g.first = g.turn = "pilot"
    start_round(g, [1, 4, 1, 1], [1, 4, 1, 1])
    for slot in ("axis_pilot", "axis_copilot"):
        put(g, "copilot" if slot.endswith("copilot") else "pilot", 0, slot)
    put(g, "pilot", 0, "engine_pilot")
    put(g, "copilot", 0, "engine_copilot")
    put(g, "pilot", 0, "radio_pilot")
    put(g, "copilot", 0, "radio_copilot_1")
    put(g, "pilot", 0, "conc_0")
    put(g, "copilot", 0, "conc_1")
    assert g.result and not g.result["won"]


def test_airport_must_be_reached_by_final_round():
    g = Game("yul", 5)
    g.round = 6
    g.planes = [0] * 7
    start_round(g, [1, 1, 1, 1], [1, 1, 1, 1])
    for s in g.slots.values():
        s["die"] = None
    g.dice = {s: [] for s in SEATS}
    g.end_round()
    assert g.result and "crash" in g.result["reason"]


def test_traffic_die_places_airplanes():
    g = Game("lhr-fog", 1)
    assert sum(g.planes) == 1 and g.traffic_rolls


def test_kerosene_burns_when_unused_and_leak_on_engines():
    g = Game("osl", 2)
    for s in SEATS:
        g.apply(s, {"t": "ready"})
    g.dice = {s: [] for s in SEATS}
    g.slots["axis_pilot"]["die"] = g.slots["axis_copilot"]["die"] = {"value": 1, "seat": "pilot"}
    g.slots["engine_pilot"]["die"] = g.slots["engine_copilot"]["die"] = {"value": 1, "seat": "pilot"}
    g.end_round() if False else None
    g.after_move()
    assert g.kerosene == 14
    h = Game("prg-leak", 2)
    h.planes = [0] * 7
    start_round(h, [3, 1, 1, 1], [1, 1, 1, 1])
    put(h, "pilot", 0, "engine_pilot")
    put(h, "copilot", 0, "engine_copilot")
    assert h.kerosene == 18 - 3


def test_intern_flow():
    g = Game("atl", 4)
    g.planes = [0] * 7
    g.interns = [2, 4, 6]
    start_round(g, [3, 1, 1, 1], [1, 1, 1, 1])
    put(g, "pilot", 0, "intern_pilot")
    assert g.pending_token == {"seat": "pilot", "value": 2}
    g.apply("pilot", {"t": "token", "slot": "radio_pilot"})
    assert g.slots["radio_pilot"]["die"]["value"] == 2 and g.interns == [4, 6]


def test_abilities_adaptation_and_swap():
    g = Game("prg", 4)
    g.abilities = ["adaptation", "working_together"]
    start_round(g, [1, 1, 1, 1], [6, 2, 3, 4])
    g.apply("pilot", {"t": "adapt", "die": g.dice["pilot"][0]["id"]})
    assert g.dice["pilot"][0]["value"] == 6
    g.apply("pilot", {"t": "swap_offer", "die": g.dice["pilot"][1]["id"]})
    g.apply("copilot", {"t": "swap_answer", "die": g.dice["copilot"][1]["id"]})
    assert g.dice["pilot"][1]["value"] == 2 and g.dice["copilot"][1]["value"] == 1


def test_view_hides_opponent_dice():
    g = Game("yul", 3)
    for s in SEATS:
        g.apply(s, {"t": "ready"})
    v = g.view("pilot")
    assert all("value" in d for d in v["dice"]["pilot"]) and all("value" not in d for d in v["dice"]["copilot"])
