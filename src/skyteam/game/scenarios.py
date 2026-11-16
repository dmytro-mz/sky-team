"""The 21 landings of the Sky Team flight log: Green, Yellow, Red and Black scenarios.

The approach tracks (length, airplanes, traffic icons, turn corridors) follow each scenario's published theme and
modules; the exact printed token positions are reconstructed, so treat them as faithful in spirit rather than a
scan of the box.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

MODULE_INFO: dict[str, tuple[str, str]] = {
    "kerosene": (
        "Kerosene",
        "Either pilot may put a die of any value on the Kerosene dial to burn that much fuel. If nobody does, "
        "6 fuel burn at the end of the round. At 0 you run dry and lose.",
    ),
    "intern": (
        "Intern",
        "Place a die of any value on your Intern space, then take the token nearest your side and play it like a die "
        "anywhere except Concentration (no coffee). The die must differ from the next token's number. Train every "
        "token before landing.",
    ),
    "wind": (
        "Wind",
        "After each Axis move the Wind token turns as many steps as the Axis is off centre. Add the wind it points to "
        "to your Engines total, even in the last round.",
    ),
    "realtime": (
        "Real-Time",
        "A 60 second timer starts when the dice are rolled. When it runs out the round ends: unplaced dice are "
        "ignored and an empty Axis or Engines space loses the game.",
    ),
    "leak": (
        "Kerosene Leak",
        "Every time both Engines are filled you lose the difference between the two dice, plus one, in kerosene. "
        "Run out and you lose.",
    ),
    "ice": (
        "Ice Brakes",
        "The Brakes are replaced: Pilot and Co-Pilot must put dice of the same value (2, 3, 4, 5 in order) on the "
        "top and bottom of the track in the same round. A lone die comes back. In the last round your speed must "
        "be lower than the marker, and the marker must pass the 5.",
    ),
}

ABILITIES: dict[str, tuple[str, str]] = {
    "working_together": (
        "Working Together",
        "Once per round either player may place a die on this skill; the other player must also place one if able. "
        "The two dice swap values, then both return.",
    ),
    "synchronisation": (
        "Synchronisation",
        "Once per round, when you have a die on both Landing Gear and Flaps, roll the Traffic die and put it on any "
        "empty space as an extra action.",
    ),
    "mastery": ("Mastery", "Two dice of the same value on the Engines gain a Reroll token, if one is available."),
    "control": ("Control", "Two dice of the same value on the Axis gain a Coffee token."),
    "anticipation": ("Anticipation", "Each round the first player may reroll one of their dice before placing."),
    "adaptation": ("Adaptation", "Once per game each player can turn one unplayed die to its opposite side."),
}

DIFFICULTIES = {
    "green": "Routine landing",
    "yellow": "Exceptional conditions",
    "red": "Elite pilots only",
    "black": "Heroic landing",
}


@dataclass(frozen=True)
class Scenario:
    id: str
    code: str
    airport: str
    city: str
    level: str
    story: str
    length: int  # spaces on the approach track, the last one is the airport
    planes: dict[int, int] = field(default_factory=dict)  # space -> airplane tokens
    traffic: dict[int, int] = field(default_factory=dict)  # space -> traffic die icons
    turns: dict[int, tuple[int, ...]] = field(default_factory=dict)  # space -> permitted axis positions
    modules: tuple[str, ...] = ()
    abilities: int = 0
    rerolls: tuple[int, ...] = (1, 3, 5)  # rounds that hold a reroll token on the altitude track
    kerosene: int = 20
    theme: str = "day"  # sky / landscape palette, see the client

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


L, R = (-2, -1), (1, 2)  # a wide left / right turn: the plane stays banked that way


def _s(id_: str, code: str, airport: str, city: str, level: str, story: str, length: int, **kw: Any) -> Scenario:
    return Scenario(id_, code, airport, city, level, story, length, **kw)


SCENARIOS: list[Scenario] = [
    # ------------------------------------------------------------------ green
    _s(
        "yul",
        "YUL",
        "Montréal-Trudeau",
        "Montréal",
        "green",
        "Sunrise over the snowy St. Lawrence River. Conditions are perfect for a smooth landing.",
        7,
        planes={2: 1, 3: 1, 5: 1},
        theme="snow",
    ),
    _s(
        "lhr",
        "LHR",
        "Heathrow",
        "London",
        "green",
        "The Thames cuts through the lights of London. Watch for traffic at the end of your approach.",
        7,
        planes={3: 1},
        traffic={4: 1, 5: 1},
        theme="dusk",
    ),
    _s(
        "hnd",
        "HND",
        "Haneda",
        "Tokyo",
        "green",
        "Mount Fuji fills the horizon. You must fly a wide left turn over Tokyo Bay to line up with the runway.",
        7,
        planes={2: 1, 4: 1},
        turns={2: L, 3: L, 4: L},
        theme="sea",
    ),
    _s(
        "osl",
        "OSL",
        "Gardermoen",
        "Oslo",
        "green",
        "Descending into Oslo with Øyeren Lake on the right. Keep an eye on your kerosene.",
        7,
        planes={3: 1, 5: 1},
        modules=("kerosene",),
        theme="forest",
    ),
    _s(
        "atl",
        "ATL",
        "Hartsfield-Jackson",
        "Atlanta",
        "green",
        "You break through the clouds over the Appalachian foothills into a sky packed with traffic, "
        "with a nervous Intern to train.",
        7,
        planes={2: 1, 4: 1},
        traffic={3: 1},
        modules=("intern",),
        theme="day",
    ),
    _s(
        "prg",
        "PRG",
        "Václav Havel",
        "Prague",
        "green",
        "Your skills are improving. Use your abilities to land in Prague, in the heart of Old Bohemia.",
        7,
        planes={2: 1, 3: 1, 5: 1},
        modules=("kerosene",),
        abilities=1,
        theme="dusk",
    ),
    # ----------------------------------------------------------------- yellow
    _s(
        "lhr-fog",
        "LHR",
        "Heathrow",
        "London",
        "yellow",
        "Heavy London fog has left planes stacked in holding patterns. Stay alert from the very start.",
        7,
        traffic={0: 1, 2: 1, 4: 1},
        modules=("intern",),
        theme="fog",
    ),
    _s(
        "tgu",
        "TGU",
        "Toncontín",
        "Tegucigalpa",
        "yellow",
        "The airport sits in a bowl of mountains: descend quickly and make a very tight final turn.",
        6,
        planes={2: 1, 4: 1},
        turns={4: (-2, -1), 5: (-1, 0)},
        modules=("kerosene",),
        abilities=1,
        theme="mountain",
    ),
    _s(
        "gig",
        "GIG",
        "Galeão",
        "Rio de Janeiro",
        "yellow",
        "The tower is not answering and a strong tailwind pushes you in too fast over Copacabana. "
        "Make a wide turn and control your speed.",
        7,
        planes={3: 1, 5: 1},
        turns={2: R, 3: R, 4: R},
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
        "You break through the low clouds to a snow-covered Icelandic airport. A light touch is needed.",
        7,
        planes={2: 1, 4: 1},
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
        "Clear skies and a view of the Carpathians, until an alarm shows you are losing fuel.",
        7,
        planes={3: 1, 5: 1},
        modules=("leak",),
        abilities=1,
        kerosene=18,
        theme="dusk",
    ),
    _s(
        "kul",
        "KUL",
        "Kuala Lumpur",
        "Kuala Lumpur",
        "yellow",
        "Electrical storms all around. Keep the plane between the storm masses for a bumpy landing.",
        7,
        planes={2: 1, 4: 1},
        turns={1: (-1, 0), 2: (-1, 0), 3: (0, 1), 4: (0, 1), 5: (-1, 0)},
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
        "American Thanksgiving at one of the busiest airports in the world, with a fuel leak and unprecedented traffic.",
        7,
        planes={3: 1},
        traffic={2: 1, 4: 1, 5: 1},
        modules=("leak",),
        abilities=1,
        kerosene=18,
        theme="day",
    ),
    # -------------------------------------------------------------------- red
    _s(
        "pbh",
        "PBH",
        "Paro",
        "Paro",
        "red",
        "A narrow valley in the Himalayan foothills at over 7,000 feet, ringed by very high, jagged mountains.",
        7,
        planes={2: 1, 4: 1},
        turns={2: (-1, 0), 3: (0, 1), 4: (-1, 0), 5: (0, 1)},
        modules=("kerosene", "realtime"),
        abilities=1,
        rerolls=(1, 5),
        kerosene=17,
        theme="mountain",
    ),
    _s(
        "hnd-red",
        "HND",
        "Haneda",
        "Tokyo",
        "red",
        "Hanami season under the cherry blossoms. Your air corridor is reduced and the skies are crowded.",
        7,
        planes={2: 1, 4: 1},
        traffic={3: 1},
        turns={3: (-1, 0), 4: (-1, 0), 5: (-2, -1)},
        modules=("kerosene", "intern"),
        abilities=1,
        rerolls=(1, 5),
        kerosene=17,
        theme="sea",
    ),
    _s(
        "gig-red",
        "GIG",
        "Galeão",
        "Rio de Janeiro",
        "red",
        "The edge of a rare South Atlantic tropical cyclone: high winds and a narrow air corridor.",
        7,
        planes={3: 1, 4: 1},
        turns={2: R, 3: (0, 1), 4: R},
        modules=("wind", "leak"),
        abilities=1,
        rerolls=(1, 5),
        kerosene=18,
        theme="storm",
    ),
    _s(
        "osl-red",
        "OSL",
        "Gardermoen",
        "Oslo",
        "red",
        "A frozen runway and kerosene running low for the last 30 minutes, with 150 passengers and crew aboard.",
        7,
        planes={2: 1, 3: 1, 5: 1},
        modules=("leak", "ice"),
        abilities=1,
        rerolls=(1, 5),
        kerosene=18,
        theme="snow",
    ),
    _s(
        "tgu-red",
        "TGU",
        "Toncontín",
        "Tegucigalpa",
        "red",
        "A very difficult approach: drop down to the left between the mountains.",
        6,
        planes={2: 1, 4: 1},
        turns={3: L, 4: L, 5: (-1, 0)},
        modules=("kerosene", "wind"),
        abilities=1,
        rerolls=(1, 5),
        kerosene=17,
        theme="mountain",
    ),
    # ------------------------------------------------------------------ black
    _s(
        "kef-black",
        "KEF",
        "Keflavík",
        "Reykjavík",
        "black",
        "You break through the clouds into a heavy blizzard. Runway lights are barely visible through the snow. "
        "Your passengers are counting on you.",
        7,
        planes={2: 1, 3: 1, 5: 1},
        traffic={4: 1},
        modules=("wind", "ice"),
        abilities=2,
        rerolls=(1,),
        theme="blizzard",
    ),
    _s(
        "kul-black",
        "KUL",
        "Kuala Lumpur",
        "Kuala Lumpur",
        "black",
        "Lightning flashes all around. Reaching the airport takes intense concentration, and time is against you. "
        "Semoga berjaya!",
        7,
        planes={2: 1, 4: 1},
        turns={1: (-1, 0), 2: (0, 1), 3: (-1, 0), 4: (0, 1), 5: (-1, 0)},
        modules=("kerosene", "realtime"),
        abilities=2,
        rerolls=(1,),
        kerosene=16,
        theme="storm",
    ),
    _s(
        "pbh-black",
        "PBH",
        "Paro",
        "Paro",
        "black",
        "The weather is clear, but this is the most dangerous airport in the world. Only eight pilots are certified "
        "to land here.",
        7,
        planes={2: 1, 3: 1, 5: 1},
        turns={2: (-1, 0), 3: (0, 1), 4: (-1, 0), 5: (0, 1)},
        modules=("kerosene", "realtime"),
        abilities=2,
        rerolls=(1,),
        kerosene=16,
        theme="mountain",
    ),
]

BY_ID = {s.id: s for s in SCENARIOS}
