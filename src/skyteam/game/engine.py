"""Sky Team rules engine. One `Game` holds the whole cockpit; every move goes through `Game.apply`."""

from __future__ import annotations

import random
from typing import Any

from skyteam.game.scenarios import ABILITIES, BY_ID, Scenario

SEATS = ("pilot", "copilot")
FINAL_ROUND = 7
SPIN = 3  # the axis arrow reaching ±3 spins the plane
MAX_COFFEE = 3
REROLL_POOL = 3
# The Wind Ring, clockwise from the white space the nose points at when the game starts (+3, a strong tail wind).
WIND_RING = (3, 3, 2, 2, 1, 0, -1, -2, -2, -3, -3, -3, -2, -2, -1, 0, 1, 2, 2, 3)
TRAFFIC_FACES = (1, 2, 3, 4, 5, 6)
PLANE_SUPPLY = 12
KEROSENE_BURN = 6
INTERN_TOKENS = 6

GEAR_VALUES = ((1, 2), (3, 4), (5, 6))
FLAP_VALUES = ((1, 2), (2, 3), (4, 5), (5, 6))
BRAKE_VALUES = (2, 4, 6)
ICE_VALUES = (2, 3, 4, 5)


class IllegalMove(Exception):
    pass


def other(seat: str) -> str:
    return "copilot" if seat == "pilot" else "pilot"


def build_slots(scenario: Scenario) -> dict[str, dict[str, Any]]:
    slots: dict[str, dict[str, Any]] = {}

    def add(sid: str, owner: str, kind: str, accepts: tuple[int, ...] | None = None, order: int = 0) -> None:
        slots[sid] = {"id": sid, "owner": owner, "kind": kind, "accepts": accepts, "order": order, "die": None}

    add("axis_pilot", "pilot", "axis")
    add("axis_copilot", "copilot", "axis")
    add("engine_pilot", "pilot", "engine")
    add("engine_copilot", "copilot", "engine")
    add("radio_pilot", "pilot", "radio")
    add("radio_copilot_1", "copilot", "radio")
    add("radio_copilot_2", "copilot", "radio")
    for i, v in enumerate(GEAR_VALUES):
        add(f"gear_{i}", "pilot", "gear", v, i)
    for i, v in enumerate(FLAP_VALUES):
        add(f"flaps_{i}", "copilot", "flaps", v, i)
    if "ice" in scenario.modules:
        for i, v in enumerate(ICE_VALUES):
            add(f"ice_pilot_{i}", "pilot", "ice", (v,), i)
            add(f"ice_copilot_{i}", "any", "ice", (v,), i)
    else:
        for i, v in enumerate(BRAKE_VALUES):
            add(f"brake_{i}", "pilot", "brake", (v,), i)
    for i in range(3):
        add(f"conc_{i}", "any", "conc", None, i)
    if "kerosene" in scenario.modules:
        add("kerosene", "any", "kerosene")
    if "intern" in scenario.modules:
        add("intern_pilot", "pilot", "intern")
        add("intern_copilot", "copilot", "intern")
    return slots


class Game:
    def __init__(
        self, scenario_id: str, seed: int | None = None, hotseat: bool = False, abilities: list[str] | None = None
    ) -> None:
        self.scenario: Scenario = BY_ID[scenario_id]
        self.rng = random.Random(seed)
        self.hotseat = hotseat
        sc = self.scenario
        self.slots = build_slots(sc)
        self.round = 1
        self.phase = "discuss"  # discuss -> place -> (next round) ... -> over
        self.ready = dict.fromkeys(SEATS, False)
        self.first = "pilot"
        self.turn = "pilot"
        self.dice: dict[str, list[dict[str, Any]]] = {s: [] for s in SEATS}
        self._next_die = 0
        self.axis = 0
        self.gear = 0
        self.flaps = 0
        self.brakes = 0
        self.ice_pairs = 0
        self.position = 0
        self.planes = [sc.planes.get(i, 0) for i in range(sc.length)]
        self.coffee = 0
        self.rerolls = 0
        self.kerosene = sc.kerosene
        self.wind = 0
        self.speed: int | None = None
        self.interns: list[int] = []
        self.intern_left = 0  # tokens already taken from the Pilot's end of the board
        self.pending_token: dict[str, Any] | None = None
        self.reroll: dict[str, Any] | None = None  # {"picks": {seat: ids|None}}
        self.swap: dict[str, Any] | None = None  # working together offer {seat, die}
        self.used: dict[str, bool] = {}
        self.sync_done = False
        self.result: dict[str, Any] | None = None
        self.log: list[dict[str, Any]] = []
        self.deadline_ms: int | None = None  # set by the room for the real-time module
        self.traffic_rolls: list[int] = []
        if "intern" in sc.modules:
            self.interns = self.rng.sample(range(1, 7), INTERN_TOKENS)
        chosen = [a for a in (abilities or []) if a in ABILITIES][: sc.abilities]
        pool = [a for a in sorted(ABILITIES) if a not in chosen]
        chosen += self.rng.sample(pool, sc.abilities - len(chosen)) if sc.abilities > len(chosen) else []
        self.abilities = chosen
        self.rerolls_on_track = len([r for r in sc.rerolls if r > 1])
        if 1 in sc.rerolls:
            self.rerolls = 1
        self.say("Round 1 of 7. Talk about your strategy, but never about the values of your dice.", "system")
        self.roll_traffic()

    # ------------------------------------------------------------------ helpers
    @property
    def mods(self) -> tuple[str, ...]:
        return self.scenario.modules

    def say(self, text: str, kind: str = "info", seat: str | None = None) -> None:
        self.log.append({"round": self.round, "text": text, "kind": kind, "seat": seat})
        del self.log[:-200]

    @property
    def last_space(self) -> int:
        return self.scenario.length - 1

    @property
    def blue(self) -> int:
        return 4 + self.gear

    @property
    def orange(self) -> int:
        return 8 + self.flaps

    @property
    def is_final(self) -> bool:
        return self.round == FINAL_ROUND

    def wind_speed(self) -> int:
        return WIND_RING[self.wind] if "wind" in self.mods else 0

    def brake_limit(self) -> int:
        """The engines total must stay strictly below this number."""
        if "ice" in self.mods:
            return self.ice_pairs + 2 if self.ice_pairs else 0
        return self.brakes * 2 + 1 if self.brakes else 0

    def lose(self, reason: str) -> None:
        if self.result is None:
            self.result = {"won": False, "reason": reason}
            self.phase = "over"
            self.deadline_ms = None
            self.say(reason, "lose")

    def new_die(self, seat: str, value: int | None = None, wild: bool = False) -> dict[str, Any]:
        self._next_die += 1
        v = value if value is not None else self.rng.randint(1, 6)
        return {"id": self._next_die, "seat": seat, "value": v, "wild": wild, "flipped": False}

    def unplaced(self, seat: str) -> list[dict[str, Any]]:
        return self.dice[seat]

    def filled(self, kind: str, owner: str | None = None) -> list[dict[str, Any]]:
        return [s for s in self.slots.values() if s["kind"] == kind and s["die"] and owner in (None, s["owner"])]

    # ------------------------------------------------------------------ round flow
    def roll_traffic(self) -> None:
        self.traffic_rolls = []
        for _ in range(self.scenario.traffic.get(self.position, 0)):
            v = self.rng.choice(TRAFFIC_FACES)
            self.traffic_rolls.append(v)
            target = min(self.position + v - 1, self.last_space)
            if sum(self.planes) >= PLANE_SUPPLY:
                self.say(f"Traffic die: {v}. No Airplane tokens left in the supply.", "info")
                continue
            self.planes[target] += 1
            self.say(f"Traffic die: {v}. An airplane appears on space {v} of the approach.", "warn")

    def start_dice(self) -> None:
        self.phase = "place"
        self.ready = dict.fromkeys(SEATS, False)
        self.turn = self.first
        self.sync_done = False
        for seat in SEATS:
            self.dice[seat] = [self.new_die(seat) for _ in range(4)]
        self.say(f"Dice are rolled. {self.first.capitalize()} places first. No talking now.", "system")
        if "realtime" in self.mods:
            self.say("The 60 second timer is running!", "warn")

    def end_round(self) -> None:
        sc = self.scenario
        if "kerosene" in self.mods:
            if self.slots["kerosene"]["die"] is None:
                self.kerosene -= KEROSENE_BURN
                self.say(
                    f"No die on the Kerosene dial: {KEROSENE_BURN} fuel burn. {max(self.kerosene, 0)} left.", "warn"
                )
            if self.kerosene <= 0:
                return self.lose("You ran out of kerosene.")
        if "ice" in self.mods:
            for i in range(len(ICE_VALUES)):
                a, b = self.slots[f"ice_pilot_{i}"], self.slots[f"ice_copilot_{i}"]
                if bool(a["die"]) != bool(b["die"]):
                    self.say("A lone Ice Brakes die comes back unmatched.", "info")
        for s in self.slots.values():
            s["die"] = None
            s.pop("done", None)
        self.dice = {s: [] for s in SEATS}
        self.pending_token = self.swap = self.reroll = None
        self.deadline_ms = None
        if self.is_final:
            return self.finish()
        self.round += 1
        self.say(f"The plane descends to {7000 - self.round * 1000} ft.", "system")
        if self.round == FINAL_ROUND and self.position != self.last_space:
            return self.lose("You are on final but the airport is not in reach: the plane crash lands.")
        if self.position == self.last_space and self.round < FINAL_ROUND:
            self.say("Over the airport already: hold the pattern, the Approach Track cannot advance.", "warn")
        if self.round in sc.rerolls and self.rerolls_on_track:
            self.rerolls_on_track -= 1
            self.rerolls += 1
            self.say("A Reroll token from the altitude track joins your supply.", "good")
        self.first = other(self.first)
        self.turn = self.first
        self.phase = "discuss"
        self.ready = dict.fromkeys(SEATS, False)
        self.used = {k: v for k, v in self.used.items() if k.startswith("game:")}
        self.roll_traffic()
        if self.is_final:
            self.say(
                "Final round! Your engines must stay below the Brakes. Landing gear, flaps, axis, planes: all clear."
            )

    def finish(self) -> None:
        problems = []
        if sum(self.planes):
            problems.append("airplanes are still on the approach")
        if self.gear < len(GEAR_VALUES):
            problems.append("the landing gear is not down")
        if self.flaps < len(FLAP_VALUES):
            problems.append("the flaps are not fully deployed")
        if self.axis != 0:
            problems.append("the plane is not level")
        if self.speed is None or self.speed >= self.brake_limit():
            problems.append("you are going too fast to stop")
        if "ice" in self.mods and self.ice_pairs < len(ICE_VALUES):
            problems.append("the ice brakes are not all engaged")
        if self.interns:
            problems.append("the Intern is not fully trained")
        if problems:
            return self.lose("Landing failed: " + ", ".join(problems) + ".")
        self.result = {"won": True, "reason": "Touchdown! The plane stops safely on the runway."}
        self.phase = "over"
        self.say(self.result["reason"], "win")

    # ------------------------------------------------------------------ resolution of spaces
    def resolve_axis(self) -> None:
        p, c = self.slots["axis_pilot"]["die"], self.slots["axis_copilot"]["die"]
        if not (p and c) or self.slots["axis_pilot"].get("done"):
            return
        self.slots["axis_pilot"]["done"] = True
        self.axis += c["value"] - p["value"]  # negative leans towards the Pilot (left)
        self.say(f"Axis: {p['value']} against {c['value']}. The plane is at {self.axis:+d}.", "info")
        if "wind" in self.mods:
            step = abs(self.axis)
            self.wind = (self.wind + step * (1 if self.axis > 0 else -1)) % len(WIND_RING)
            self.say(f"The wind token turns {step} space(s): it now adds {self.wind_speed():+d} to your speed.", "info")
        if "control" in self.abilities and p["value"] == c["value"]:
            self.gain_coffee("Control")
        if abs(self.axis) >= SPIN:
            self.lose("The plane spins out of control.")

    def gain_coffee(self, why: str = "") -> None:
        if self.coffee < MAX_COFFEE:
            self.coffee += 1
            self.say(f"A Coffee token {why}".strip() + ".", "good")

    def resolve_engines(self) -> None:
        p, c = self.slots["engine_pilot"]["die"], self.slots["engine_copilot"]["die"]
        if not (p and c) or self.slots["engine_pilot"].get("done"):
            return
        self.slots["engine_pilot"]["done"] = True
        total = p["value"] + c["value"] + self.wind_speed()
        self.speed = total
        wind = f" (wind {self.wind_speed():+d})" if "wind" in self.mods else ""
        if (
            "mastery" in self.abilities
            and p["value"] == c["value"]
            and self.rerolls + self.rerolls_on_track < REROLL_POOL
        ):
            self.rerolls += 1
            self.say("Mastery: matching Engines earn a Reroll token.", "good")
        if "leak" in self.mods:
            loss = abs(p["value"] - c["value"]) + 1
            self.kerosene -= loss
            self.say(f"The leak costs {loss} kerosene. {max(self.kerosene, 0)} left.", "warn")
            if self.kerosene <= 0:
                return self.lose("You ran out of kerosene.")
        if self.is_final:
            self.say(f"Engines total {total}{wind}. Brakes must stay above it.", "info")
            return
        moves = 0 if total <= self.blue else 1 if total <= self.orange else 2
        self.say(f"Engines total {total}{wind}: {'hold position' if not moves else f'advance {moves}'}.", "info")
        for _ in range(moves):
            if self.position == self.last_space:
                return self.lose("You overshoot the airport.")
            if self.planes[self.position]:
                return self.lose("Collision with an airplane on the approach!")
            self.position += 1
            allowed = self.scenario.turns.get(self.position)
            if allowed is not None and self.axis not in allowed:
                return self.lose("The plane is not lined up for the turn and leaves the corridor.")

    # ------------------------------------------------------------------ queries for the UI
    def can_use(self, seat: str, die: dict[str, Any], slot: dict[str, Any], value: int) -> str | None:
        """None when `die` showing `value` may go on `slot`, else the reason it cannot."""
        if slot["die"] is not None or slot.get("on"):
            return "That space is taken."
        if slot["owner"] not in ("any", seat) and not die.get("wild"):
            return f"That space belongs to the {slot['owner']}."
        if slot["accepts"] and value not in slot["accepts"]:
            return "The die does not match that space."
        kind, order = slot["kind"], slot["order"]
        if kind == "flaps" and any(not self.slots[f"flaps_{i}"].get("on") for i in range(order)):
            return "Flaps must be deployed in order."
        if kind == "brake" and any(not self.slots[f"brake_{i}"].get("on") for i in range(order)):
            return "Brakes must be deployed in order."
        if kind == "ice":
            if self.ice_pairs != order:
                return "Ice Brakes go in order, left to right."
        if kind == "intern":
            if not self.interns:
                return "The Intern is fully trained."
            nxt = self.interns[0] if seat == "pilot" else self.interns[-1]
            if value == nxt:
                return f"The die must differ from the next token ({nxt})."
        return None

    def must_keep(self, seat: str) -> int:
        """Axis and Engines spaces this seat still has to fill with dice."""
        return sum(1 for k in ("axis", "engine") if self.slots[f"{k}_{seat}"]["die"] is None)

    # ------------------------------------------------------------------ the one entry point
    def apply(self, seat: str, action: dict[str, Any]) -> None:
        if self.result is not None:
            raise IllegalMove("The game is over.")
        handler = getattr(self, f"do_{action.get('t')}", None)
        if handler is None:
            raise IllegalMove("Unknown action.")
        handler(seat, action)

    def do_ready(self, seat: str, action: dict[str, Any]) -> None:
        if self.phase != "discuss":
            raise IllegalMove("Not the time for that.")
        self.ready[seat] = True
        if all(self.ready.values()):
            self.start_dice()
            if "anticipation" in self.abilities:
                self.say("Anticipation: the first player may reroll one die before placing.", "info")

    def do_place(self, seat: str, action: dict[str, Any]) -> None:
        if self.phase != "place":
            raise IllegalMove("Dice are not rolled yet.")
        if self.reroll or self.swap:
            raise IllegalMove("Finish the reroll or swap first.")
        if self.pending_token:
            raise IllegalMove("Place the Intern token first.")
        die = next((d for d in self.dice[seat] if d["id"] == action.get("die")), None)
        if die is None:
            raise IllegalMove("You don't have that die.")
        if self.turn != seat and not die["wild"]:
            raise IllegalMove("It is not your turn.")
        slot = self.slots.get(str(action.get("slot")))
        if slot is None:
            raise IllegalMove("No such space.")
        delta = int(action.get("coffee", 0))
        value = die["value"] + delta
        if abs(delta) > self.coffee or not 1 <= value <= 6:
            raise IllegalMove("You can't change the die that way.")
        if bad := self.can_use(seat, die, slot, value):
            raise IllegalMove(bad)
        is_mandatory = slot["kind"] in ("axis", "engine")
        if not is_mandatory and not die["wild"] and len(self.dice[seat]) - 1 < self.must_keep(seat):
            raise IllegalMove("Keep a die for your Axis and Engines.")
        self.dice[seat].remove(die)
        self.coffee -= abs(delta)
        placed = {"id": die["id"], "seat": seat, "value": value, "orig": die["value"], "coffee": abs(delta)}
        self.drop(seat, slot, placed)
        if self.result is None and not die["wild"] and not self.pending_token:
            self.advance_turn(seat)
        self.after_move()

    def advance_turn(self, seat: str) -> None:
        self.turn = other(seat) if self.dice[other(seat)] else seat

    def drop(self, seat: str, slot: dict[str, Any], placed: dict[str, Any]) -> None:
        slot["die"] = placed
        value, kind = placed["value"], slot["kind"]
        shown = f"{value}" + (f" (was {placed['orig']})" if placed["orig"] != value else "")
        self.say(f"{seat.capitalize()} places {shown} on {kind}.", "move", seat)
        if kind == "axis":
            self.resolve_axis()
        elif kind == "engine":
            self.resolve_engines()
        elif kind == "radio":
            idx = self.position + value - 1
            if idx <= self.last_space and self.planes[idx]:
                self.planes[idx] -= 1
                self.say("Radio: an airplane is cleared from the approach.", "good")
            else:
                self.say("Radio: nobody there.", "info")
        elif kind == "gear":
            self.gear += 1
            slot["on"] = True
        elif kind == "flaps":
            self.flaps += 1
            slot["on"] = True
        elif kind == "brake":
            self.brakes += 1
            slot["on"] = True
        elif kind == "conc":
            self.gain_coffee("for concentrating")
        elif kind == "kerosene":
            self.kerosene -= value
            self.say(f"The kerosene burns down to {max(self.kerosene, 0)}.", "warn")
            if self.kerosene <= 0:
                self.lose("You ran out of kerosene.")
        elif kind == "ice":
            a, b = self.slots[f"ice_pilot_{slot['order']}"], self.slots[f"ice_copilot_{slot['order']}"]
            if a["die"] and b["die"]:
                self.ice_pairs += 1
                a["on"] = b["on"] = True
                self.say("Ice Brakes engaged.", "good")
        elif kind == "intern":
            token = self.interns.pop(0 if seat == "pilot" else -1)
            self.intern_left += seat == "pilot"
            self.pending_token = {"seat": seat, "value": token}
            self.say(f"The Intern hands over a {token}. Place it like a die (no Concentration).", "info", seat)
            if not self.token_slots():
                self.pending_token = None
                self.say("There is nowhere to put the token, it is set aside.", "info")
        if (
            "synchronisation" in self.abilities
            and not self.sync_done
            and self.result is None
            and self.filled("gear")
            and self.filled("flaps")
        ):
            self.sync_done = True
            v = self.rng.choice(TRAFFIC_FACES)
            self.dice[seat].append(self.new_die(seat, v, wild=True))
            self.say(f"Synchronisation: the Traffic die shows {v}. {seat.capitalize()} places it anywhere.", "good")

    def token_slots(self) -> list[str]:
        tok = self.pending_token
        if not tok:
            return []
        return [
            sid
            for sid, s in self.slots.items()
            if s["kind"] not in ("conc", "intern") and not self.can_use(tok["seat"], {"wild": False}, s, tok["value"])
        ]

    def do_token(self, seat: str, action: dict[str, Any]) -> None:
        tok = self.pending_token
        if not tok or tok["seat"] != seat:
            raise IllegalMove("No Intern token to place.")
        slot = self.slots.get(str(action.get("slot")))
        if slot is None or slot["kind"] in ("conc", "intern"):
            raise IllegalMove("The token can't go there.")
        if bad := self.can_use(seat, {"wild": False}, slot, tok["value"]):
            raise IllegalMove(bad)
        self.pending_token = None
        self.drop(seat, slot, {"id": -1, "seat": seat, "value": tok["value"], "orig": tok["value"], "coffee": 0})
        if self.result is None:
            self.advance_turn(seat)
        self.after_move()

    def after_move(self) -> None:
        if self.result is not None or self.phase != "place":
            return
        if self.pending_token or any(self.dice[s] for s in SEATS):
            if not self.dice[self.turn] and not self.pending_token:
                self.turn = other(self.turn)
            return
        for k in ("axis", "engine"):
            if any(self.slots[f"{k}_{s}"]["die"] is None for s in SEATS):
                return self.lose("You failed to fill the Axis and the Engines.")
        self.end_round()

    # ------------------------------------------------------------------ rerolls and abilities
    def do_reroll_open(self, seat: str, action: dict[str, Any]) -> None:
        if self.phase != "place" or self.reroll or self.swap:
            raise IllegalMove("You can only reroll while dice are in hand.")
        if self.rerolls < 1:
            raise IllegalMove("No Reroll token available.")
        self.reroll = {"picks": dict.fromkeys(SEATS)}
        self.say(f"{seat.capitalize()} spends a Reroll token: both choose dice to roll again.", "warn", seat)

    def do_reroll_pick(self, seat: str, action: dict[str, Any]) -> None:
        if not self.reroll:
            raise IllegalMove("No reroll in progress.")
        ids = {int(i) for i in action.get("dice", [])}
        mine = {d["id"] for d in self.dice[seat] if not d["wild"] or True}
        if not ids <= mine:
            raise IllegalMove("Those dice are not yours.")
        self.reroll["picks"][seat] = sorted(ids)
        if all(v is not None for v in self.reroll["picks"].values()):
            self.rerolls -= 1
            for s in SEATS:
                for d in self.dice[s]:
                    if d["id"] in self.reroll["picks"][s]:
                        d["value"] = self.rng.randint(1, 6)
            self.say("The dice are rolled again.", "info")
            self.reroll = None

    def do_reroll_cancel(self, seat: str, action: dict[str, Any]) -> None:
        self.reroll = None

    def do_anticipate(self, seat: str, action: dict[str, Any]) -> None:
        if "anticipation" not in self.abilities or self.phase != "place":
            raise IllegalMove("Not available.")
        placed_any = any(s["die"] for s in self.slots.values())
        if seat != self.first or placed_any or self.used.get(f"anticipation:{seat}"):
            raise IllegalMove("Anticipation: first player, before placing the first die, once a round.")
        die = next((d for d in self.dice[seat] if d["id"] == action.get("die")), None)
        if die is None:
            raise IllegalMove("You don't have that die.")
        die["value"] = self.rng.randint(1, 6)
        self.used[f"anticipation:{seat}"] = True
        self.say(f"Anticipation: {seat} rerolls a die.", "info", seat)

    def do_adapt(self, seat: str, action: dict[str, Any]) -> None:
        if "adaptation" not in self.abilities or self.phase != "place":
            raise IllegalMove("Not available.")
        key = f"game:adapt:{seat}"
        if self.used.get(key):
            raise IllegalMove("Already used this game.")
        die = next((d for d in self.dice[seat] if d["id"] == action.get("die")), None)
        if die is None:
            raise IllegalMove("You don't have that die.")
        die["value"] = 7 - die["value"]
        self.used[key] = True
        self.say(f"Adaptation: {seat} turns a die to its opposite side.", "info", seat)

    def do_swap_offer(self, seat: str, action: dict[str, Any]) -> None:
        if "working_together" not in self.abilities or self.phase != "place":
            raise IllegalMove("Not available.")
        if self.used.get("wt") or self.swap or self.reroll:
            raise IllegalMove("Working Together is already used this round.")
        if not any(d["id"] == action.get("die") for d in self.dice[seat]):
            raise IllegalMove("You don't have that die.")
        self.swap = {"seat": seat, "die": action["die"]}
        self.say(f"{seat.capitalize()} starts Working Together: the other pilot must offer a die.", "warn", seat)

    def do_swap_answer(self, seat: str, action: dict[str, Any]) -> None:
        if not self.swap or self.swap["seat"] == seat:
            raise IllegalMove("Nothing to answer.")
        mine = next((d for d in self.dice[seat] if d["id"] == action.get("die")), None)
        if mine is None:
            raise IllegalMove("You don't have that die.")
        theirs = next(d for d in self.dice[self.swap["seat"]] if d["id"] == self.swap["die"])
        mine["value"], theirs["value"] = theirs["value"], mine["value"]
        self.used["wt"] = True
        self.swap = None
        self.say("Working Together: the two dice swap values.", "good")

    def do_swap_cancel(self, seat: str, action: dict[str, Any]) -> None:
        self.swap = None

    def do_timeout(self, seat: str, action: dict[str, Any]) -> None:
        """Real-time module: the clock ran out."""
        if self.phase != "place" or "realtime" not in self.mods:
            raise IllegalMove("No timer running.")
        self.say("Time is up! Unplaced dice are ignored.", "warn")
        self.dice = {s: [] for s in SEATS}
        self.pending_token = self.swap = self.reroll = None
        for k in ("axis", "engine"):
            if any(self.slots[f"{k}_{s}"]["die"] is None for s in SEATS):
                return self.lose("Time ran out before the Axis and Engines were filled.")
        self.end_round()

    # ------------------------------------------------------------------ serialisation
    def view(self, viewer: str | None) -> dict[str, Any]:
        """Game state for one seat. `viewer=None` is the hot-seat view and reveals every die."""
        sc = self.scenario
        dice = {}
        for s in SEATS:
            if viewer in (None, s):
                dice[s] = [dict(d) for d in self.dice[s]]
            else:
                dice[s] = [{"id": d["id"], "hidden": True, "wild": d["wild"]} for d in self.dice[s]]
        slots = {}
        for sid, s in self.slots.items():
            slots[sid] = {
                "die": s["die"],
                "on": bool(s.get("on")),
                "owner": s["owner"],
                "kind": s["kind"],
                "accepts": s["accepts"],
            }
        return {
            "scenario": sc.public(),
            "round": self.round,
            "phase": self.phase,
            "ready": self.ready,
            "first": self.first,
            "turn": self.turn,
            "dice": dice,
            "slots": slots,
            "axis": self.axis,
            "gear": self.gear,
            "flaps": self.flaps,
            "brakes": self.brakes,
            "icePairs": self.ice_pairs,
            "blue": self.blue,
            "orange": self.orange,
            "position": self.position,
            "planes": self.planes,
            "coffee": self.coffee,
            "rerolls": self.rerolls,
            "rerollsOnTrack": self.rerolls_on_track,
            "kerosene": self.kerosene,
            "wind": self.wind,
            "windSpeed": self.wind_speed(),
            "windRing": list(WIND_RING),
            "speed": self.speed,
            "brakeLimit": self.brake_limit(),
            "interns": list(self.interns),
            "internLeft": self.intern_left,
            "pendingToken": self.pending_token
            if viewer in (None, (self.pending_token or {}).get("seat"))
            else ({"seat": self.pending_token["seat"]} if self.pending_token else None),
            "reroll": {"picked": {s: v is not None for s, v in self.reroll["picks"].items()}} if self.reroll else None,
            "swap": {"seat": self.swap["seat"]} if self.swap else None,
            "abilities": [{"key": a, "name": ABILITIES[a][0], "text": ABILITIES[a][1]} for a in self.abilities],
            "used": self.used,
            "communication": self.phase == "discuss",
            "trafficRolls": self.traffic_rolls,
            "log": self.log[-40:],
            "result": self.result,
            "final": self.is_final,
            "deadline": self.deadline_ms,
            "hotseat": self.hotseat,
        }
