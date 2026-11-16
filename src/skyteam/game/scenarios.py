"""The 21 landings of the Sky Team flight log (Green, Yellow, Red and Black).

Every Approach Track below was transcribed space by space from the printed strips of the box: Airplane tokens,
Traffic die icons and turn tabs. Modules and the number of Special Ability cards come from each strip's header and
the Flight Log. Tracks are written from the Airport (top of the strip) down to the start (the clouds), exactly as
they read on the cardboard, and stored here from the start towards the airport.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

MODULE_INFO: dict[str, tuple[str, str]] = {
    "kerosene": (
        "Kerosene",
        "Either player may place a die of any value on the Kerosene space and move the marker down that many "
        "spaces. At the very end of the round, if no die is there, lose 6 Kerosene. If the marker reaches the red "
        "cross at any time, even in the final round, you have run out of kerosene and lose.",
    ),
    "intern": (
        "Intern",
        "On your turn you may place a die of any value on the Intern space of your colour and take the token "
        "closest to your side. Place it on any space where you could normally place a die (never Concentration) "
        "and resolve it with the token's number. Coffee cannot modify a token. The die you place must differ from "
        "the next token's value. All tokens must be taken before you land.",
    ),
    "wind": (
        "Wind",
        "Right after the Axis phase turn the blue Airplane token one space around the Wind Ring for every mark the "
        "Axis is off centre (toward that side), even if the Axis did not move. During the Engine phase add the "
        "wind value its nose points to to the Engines total, in every round including the last.",
    ),
    "realtime": (
        "Real-Time",
        "Start a 60 second timer right after rolling the dice. Once it runs out, the round ends immediately and "
        "unplaced dice are ignored. If the Axis and Engine spaces are not filled, you lose.",
    ),
    "leak": (
        "Kerosene Leak",
        "The Kerosene Space cannot be used and you no longer lose 6 at round end. Instead, each round your kerosene "
        "loss is the difference between your two Engine dice, plus 1. The Kerosene marker starts at 20.",
    ),
    "ice": (
        "Ice Brakes",
        "The Ice Brakes board replaces the Brakes. Two dice of the same value must be placed above and below the "
        "track in the same round, from left to right. A lone die is taken back. You may move the marker more than "
        "once a round. The marker must pass the 5 before the end, and in the last round your speed must be lower "
        "than the Brake marker.",
    ),
}

ABILITIES: dict[str, tuple[str, str]] = {
    "anticipation": (
        "Anticipation",
        "Each round before placing their 1st die, the first player may choose to reroll one of their dice.",
    ),
    "adaptation": (
        "Adaptation",
        "Once per game, each player can turn one of their unplayed dice to its opposite face.",
    ),
    "control": (
        "Control",
        "If you play two dice of the same value on the AXIS, immediately gain a Coffee token.",
    ),
    "mastery": (
        "Mastery",
        "If you play two dice with the same value on the ENGINES, immediately gain a Reroll token "
        "(only if a token is available).",
    ),
    "synchronisation": (
        "Synchronisation",
        "Once per round, if you have placed at least one die on Landing Gear and one die on Flaps, immediately roll "
        "the Traffic die. Place it on any empty space on the Control Panel regardless of its colour, and apply its "
        "effect as if it were a normal die. It counts as an extra action for this turn.",
    ),
    "working_together": (
        "Working Together",
        "Once per round, at any time, a player may place one of their dice onto this skill. The other player MUST "
        "also place one of their dice on this skill (if they have one available). The players swap the values of "
        "the 2 dice, then take them back.",
    ),
}

DIFFICULTIES = {
    "green": "Routine Landing",
    "yellow": "Exceptional Conditions",
    "red": "Elite Pilots Only",
    "black": "Heroic Landing",
}


@dataclass(frozen=True)
class Scenario:
    id: str
    code: str
    airport: str
    city: str
    level: str
    story: str
    length: int  # spaces on the approach track; index 0 is the start (clouds), the last one is the airport
    planes: dict[int, int] = field(default_factory=dict)  # space -> Airplane tokens printed there
    traffic: dict[int, int] = field(default_factory=dict)  # space -> Traffic die icons
    turns: dict[int, tuple[int, ...]] = field(default_factory=dict)  # space -> permitted Axis positions
    modules: tuple[str, ...] = ()
    abilities: int = 0  # the star on the strip: how many Special Ability cards are used
    rerolls: tuple[int, ...] = (1, 5)  # rounds whose altitude space carries a Reroll token
    kerosene: int = 20
    theme: str = "day"

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "airport": self.airport,
            "city": self.city,
            "level": self.level,
            "levelName": DIFFICULTIES[self.level],
            "story": self.story,
            "length": self.length,
            "planes": {str(k): v for k, v in self.planes.items()},
            "traffic": {str(k): v for k, v in self.traffic.items()},
            "turns": {str(k): list(v) for k, v in self.turns.items()},
            "modules": [{"key": m, "name": MODULE_INFO[m][0], "text": MODULE_INFO[m][1]} for m in self.modules],
            "abilities": self.abilities,
            "rerolls": list(self.rerolls),
            "kerosene": self.kerosene,
            "theme": self.theme,
        }


def _tab(s: str) -> tuple[int, ...]:
    """A turn tab shows five marks for the Axis positions -2 -1 0 +1 +2 (left = Pilot); "o" is permitted."""
    return tuple(p for p, c in zip(range(-2, 3), s, strict=True) if c == "o")


# One row per space, read from the Airport down to the clouds: (airplanes, traffic icons, turn tab or "").
Row = tuple[int, int, str]


def _track(rows: list[Row]) -> dict[str, Any]:
    n = len(rows)
    planes: dict[int, int] = {}
    traffic: dict[int, int] = {}
    turns: dict[int, tuple[int, ...]] = {}
    for i, (p, t, tab) in enumerate(rows):
        idx = n - 1 - i
        if p:
            planes[idx] = p
        if t:
            traffic[idx] = t
        if tab:
            turns[idx] = _tab(tab)
    return {"length": n, "planes": planes, "traffic": traffic, "turns": turns}


def _s(
    id_: str,
    code: str,
    airport: str,
    city: str,
    level: str,
    story: str,
    rows: list[Row],
    modules: tuple[str, ...] = (),
    abilities: int = 0,
    theme: str = "day",
) -> Scenario:
    rerolls = (1,) if level in ("red", "black") else (1, 5)
    return Scenario(
        id_,
        code,
        airport,
        city,
        level,
        story,
        modules=modules,
        abilities=abilities,
        rerolls=rerolls,
        theme=theme,
        **_track(rows),
    )


SCENARIOS: list[Scenario] = [
    # ------------------------------------------------------------------ green
    _s(
        "yul",
        "YUL",
        "Montréal-Trudeau",
        "Montréal",
        "green",
        "Your first flight is going well. The sun is rising over the horizon, and the snow-covered landscape is "
        "magnificent as you glide over the St. Lawrence River. Perfect conditions for a smooth landing.",
        [(2, 0, ""), (3, 0, ""), (1, 0, ""), (2, 0, ""), (1, 0, ""), (0, 0, ""), (0, 0, "")],
        theme="snow",
    ),
    _s(
        "lhr",
        "LHR",
        "Heathrow",
        "London",
        "green",
        "You see the river Thames cutting a black channel through the lights of London as you near the airport. "
        "There is traffic at the end of your approach. Stay calm and land your plane.",
        [(2, 0, ""), (2, 1, ""), (2, 0, ""), (1, 1, ""), (1, 0, ""), (0, 1, "")],
        theme="dusk",
    ),
    _s(
        "hnd",
        "HND",
        "Haneda",
        "Tokyo",
        "green",
        "With iconic Mount Fuji in the background, you must execute a wide left turn to bring your plane over Tokyo "
        "Bay and in line with the runway, which juts out into the water.",
        [(1, 0, ""), (2, 0, ""), (0, 0, "oooxx"), (1, 0, "ooxxx"), (2, 0, ""), (1, 0, "xooxx"), (1, 0, ""), (0, 2, "")],
        theme="sea",
    ),
    _s(
        "osl",
        "OSL",
        "Gardermoen",
        "Oslo",
        "green",
        "You begin your descent into Oslo, the city to your left, with the sun shimmering off the long narrow "
        "Øyeren Lake to your right. Keep your eyes on your kerosene. Happy landing!",
        [(0, 0, ""), (1, 0, ""), (1, 0, ""), (1, 0, ""), (0, 1, ""), (1, 0, ""), (0, 0, ""), (0, 2, "")],
        modules=("kerosene",),
        theme="forest",
    ),
    _s(
        "atl",
        "ATL",
        "Hartsfield-Jackson",
        "Atlanta",
        "green",
        "As you break through the clouds, you pass over the Appalachian foothills to see Atlanta... and a sky packed "
        "with traffic. On top of that, you have a nervous Intern to train. Good luck.",
        [(2, 0, ""), (1, 0, ""), (2, 1, ""), (1, 1, ""), (0, 0, ""), (0, 1, ""), (0, 0, ""), (0, 4, "")],
        modules=("intern",),
        theme="day",
    ),
    _s(
        "prg",
        "PRG",
        "Václav Havel",
        "Prague",
        "green",
        "Your skill set is improving. Use these abilities to land safely in Prague, one of Europe's cultural "
        "centres, in the heart of Old Bohemia.",
        [(1, 0, ""), (1, 0, ""), (1, 1, ""), (0, 0, ""), (1, 0, "xxxoo"), (1, 1, ""), (0, 0, "xooxx"), (0, 1, "")],
        modules=("kerosene",),
        abilities=2,
        theme="dusk",
    ),
    # ------------------------------------------------------------------ yellow
    _s(
        "lhr-fog",
        "LHR",
        "Heathrow",
        "London",
        "yellow",
        "Heavy fog, common in London, has caused the sky to fill with planes in holding patterns over the British "
        "capital. You will need to stay alert right from the start of your approach!",
        [(2, 0, ""), (1, 1, ""), (2, 1, ""), (1, 1, ""), (1, 0, ""), (1, 2, "")],
        modules=("intern",),
        theme="fog",
    ),
    _s(
        "tgu",
        "TGU",
        "Toncontín",
        "Tegucigalpa",
        "yellow",
        "This airport is nestled at the base of a bowl of mountains; you will need to descend rapidly and make a "
        "very tight final turn. Welcome to Honduras!",
        [(1, 0, ""), (1, 0, "ooxxx"), (1, 0, "xooxx"), (1, 0, "ooxxx"), (0, 3, "")],
        modules=("kerosene",),
        abilities=2,
        theme="mountain",
    ),
    _s(
        "gig",
        "GIG",
        "Galeão",
        "Rio de Janeiro",
        "yellow",
        "The Rio de Janeiro control tower is not responding. The strong tail wind is bringing you in much too fast "
        "as you pass over Copacabana beach. Make a wide turn and control your approach speed.",
        [(1, 0, ""), (3, 0, ""), (2, 1, ""), (1, 1, ""), (2, 0, ""), (0, 0, ""), (0, 2, "")],
        modules=("wind",),
        abilities=1,
        theme="sea",
    ),
    _s(
        "kef",
        "KEF",
        "Keflavík",
        "Reykjavík",
        "yellow",
        "As you break through the low clouds, you see the peninsula with the Icelandic airport. It is all white, "
        "covered in new-fallen snow. You're going to need a light touch to arrive safely in the \"Land of Fire "
        'and Ice".',
        [(0, 0, ""), (1, 1, ""), (1, 0, ""), (1, 1, ""), (0, 0, ""), (0, 2, "")],
        modules=("ice",),
        abilities=1,
        theme="snow",
    ),
    _s(
        "prg-leak",
        "PRG",
        "Václav Havel",
        "Prague",
        "yellow",
        "The sky is clear, giving a gorgeous view of the Carpathian mountains in the distance... An alarm sounds. "
        "You are losing fuel. Will you have enough to make it? Manage your speed, and may luck be on your side.",
        [(3, 0, ""), (2, 0, ""), (3, 1, ""), (0, 0, ""), (3, 1, ""), (1, 0, ""), (0, 0, ""), (0, 0, "")],
        modules=("leak",),
        abilities=2,
        theme="dusk",
    ),
    _s(
        "kul",
        "KUL",
        "Kuala Lumpur",
        "Kuala Lumpur",
        "yellow",
        "You are right to be concerned about Malaysia's electrical storms... Keep your plane in line between the "
        "storm masses. It will be a bumpy landing in Kuala Lumpur.",
        [
            (1, 0, ""),
            (1, 0, "xxxoo"),
            (1, 0, ""),
            (0, 0, "xxxoo"),
            (1, 1, "xxoox"),
            (1, 0, ""),
            (0, 0, "xxxoo"),
            (0, 2, ""),
        ],
        modules=("kerosene",),
        abilities=1,
        theme="storm",
    ),
    _s(
        "atl-leak",
        "ATL",
        "Hartsfield-Jackson",
        "Atlanta",
        "yellow",
        "You are approaching one of the busiest airports in the world... on American Thanksgiving. You've never "
        "seen traffic like this in your entire career, but a fuel leak means you'll need to push through to make "
        "it in time. Happy holidays to everyone but you!",
        [(1, 0, ""), (3, 0, "xxxoo"), (1, 0, ""), (2, 1, ""), (2, 2, ""), (0, 0, "xooox"), (1, 1, ""), (0, 1, "")],
        modules=("leak",),
        abilities=1,
        theme="day",
    ),
    # ------------------------------------------------------------------ red
    _s(
        "pbh",
        "PBH",
        "Paro",
        "Paro",
        "red",
        "They call them foothills, but anywhere else they'd be called mountains. You are landing in Bhutan, on the "
        "edge of the Himalayas, at an altitude of over 7,000 feet. It's a narrow valley. The mountains are so high "
        "and jagged...",
        [(1, 0, ""), (1, 0, "xxxoo"), (1, 1, "oooxx"), (1, 0, "ooxxx"), (1, 0, ""), (0, 3, "")],
        modules=("kerosene", "realtime"),
        abilities=2,
        theme="mountain",
    ),
    _s(
        "hnd-red",
        "HND",
        "Haneda",
        "Tokyo",
        "red",
        "Your air corridor has been reduced. It is hanami, the cherry blossom festival, and the skies are packed "
        "with planes. It will take all your focus to navigate your approach.",
        [
            (1, 0, ""),
            (1, 0, "ooxxx"),
            (2, 1, ""),
            (1, 1, "xooxx"),
            (1, 1, "ooxxx"),
            (1, 0, ""),
            (0, 0, "xooxx"),
            (1, 3, ""),
        ],
        modules=("kerosene", "intern"),
        abilities=1,
        theme="sea",
    ),
    _s(
        "gig-red",
        "GIG",
        "Galeão",
        "Rio de Janeiro",
        "red",
        "Arriving at the tail end of a rare South Atlantic tropical cyclone means seriously high winds and a narrow "
        "air corridor. You have what it takes to make this landing... But why are your palms so sweaty?",
        [(2, 0, ""), (1, 0, ""), (1, 1, ""), (2, 0, ""), (2, 1, ""), (1, 0, ""), (0, 3, "")],
        modules=("wind", "leak"),
        abilities=2,
        theme="storm",
    ),
    _s(
        "osl-red",
        "OSL",
        "Gardermoen",
        "Oslo",
        "red",
        "The runway is frozen solid and your kerosene gauge has been running low for 30 minutes already. 150 "
        "passengers and crew are depending on you. Don't let them down.",
        [(0, 0, ""), (0, 1, ""), (1, 0, ""), (0, 1, ""), (0, 0, ""), (1, 1, ""), (0, 0, ""), (1, 3, "")],
        modules=("leak", "ice"),
        abilities=2,
        theme="snow",
    ),
    _s(
        "tgu-red",
        "TGU",
        "Toncontín",
        "Tegucigalpa",
        "red",
        "When are they going to build a new airport at Tegucigalpa? Landing here haunts your dreams. When you "
        "learned what your destination was, your stomach flipped. Drop down to the left between the mountains and "
        "do what it takes.",
        [(2, 0, ""), (1, 0, "ooxxx"), (1, 2, "xooxx"), (1, 0, "ooxxx"), (0, 3, "")],
        modules=("kerosene", "wind"),
        abilities=2,
        theme="mountain",
    ),
    # ------------------------------------------------------------------ black
    _s(
        "kef-black",
        "KEF",
        "Keflavík",
        "Reykjavík",
        "black",
        "As you pierce the clouds, you find yourself in the midst of an incredible blizzard. The runway lights can "
        "be dimly seen through the snow. Your passengers are depending on you. Concentrate. Focus. Land.",
        [(0, 0, ""), (1, 0, "xooox"), (1, 0, "xxooo"), (2, 1, ""), (0, 0, "oooxx"), (0, 2, "")],
        modules=("wind", "ice"),
        abilities=2,
        theme="snow",
    ),
    _s(
        "kul-black",
        "KUL",
        "Kuala Lumpur",
        "Kuala Lumpur",
        "black",
        "Lightning flashes all around as you approach. This must be what it's like to fly into hell. Getting to the "
        "airport is going to take every last ounce of your concentration. Time is against you. Semoga berjaya, as "
        "the locals would say.",
        [
            (1, 0, ""),
            (1, 0, "xxxoo"),
            (1, 1, "xxoox"),
            (1, 0, "xooxx"),
            (0, 0, "oxxxx"),
            (1, 1, ""),
            (0, 0, "xxoox"),
            (0, 3, ""),
        ],
        modules=("kerosene", "realtime"),
        abilities=2,
        theme="storm",
    ),
    _s(
        "pbh-black",
        "PBH",
        "Paro",
        "Paro",
        "black",
        "Welcome back to the most dangerous airport in the world. The weather is clear at least, but one thought "
        "keeps returning: only 8 pilots in the world are certified to land here. It's time to add your name to "
        "the list... Or not.",
        [(1, 0, ""), (1, 1, "xxxxo"), (1, 1, "ooxxx"), (1, 1, "ooxxx"), (0, 0, ""), (1, 3, "")],
        modules=("kerosene", "realtime"),
        abilities=2,
        theme="mountain",
    ),
]

BY_ID = {s.id: s for s in SCENARIOS}
