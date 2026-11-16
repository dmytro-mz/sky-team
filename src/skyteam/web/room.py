"""A table: two seats (Pilot, Co-Pilot), a lobby with scenario choice, and one running game."""

from __future__ import annotations

import time
from typing import Any

from skyteam.game.engine import SEATS, Game, IllegalMove
from skyteam.game.scenarios import BY_ID, SCENARIOS
from skyteam.progress import Progress

REALTIME_SECONDS = 60


class RoomError(Exception):
    pass


class Member:
    def __init__(self, member_id: str, name: str) -> None:
        self.id = member_id
        self.name = name
        self.conns: list[Any] = []

    @property
    def online(self) -> bool:
        return bool(self.conns)


class Room:
    def __init__(self, code: str, progress: Progress) -> None:
        self.id = code
        self.progress = progress
        self.members: dict[str, Member] = {}
        self.host: str | None = None
        self.scenario = SCENARIOS[0].id
        self.hotseat = False
        self.seats: dict[str, str | None] = dict.fromkeys(SEATS)
        self.game: Game | None = None
        self.recorded = False
        self.touched = time.monotonic()
        self.deadline: float | None = None

    # ------------------------------------------------------------- membership
    @property
    def idle_for(self) -> float:
        if any(m.online for m in self.members.values()):
            return 0.0
        return time.monotonic() - self.touched

    def join(self, token: str, name: Any) -> Member:
        label = (str(name).strip()[:20] if name else "") or f"Pilot {len(self.members) + 1}"
        member = self.members.get(token)
        if member is None:
            member = self.members[token] = Member(token, label)
            if self.host is None:
                self.host = token
        else:
            member.name = label
        return member

    def connect(self, conn: Any) -> None:
        self.members[conn.member_id].conns.append(conn)
        self.broadcast()

    def disconnect(self, conn: Any) -> None:
        m = self.members.get(conn.member_id)
        if m and conn in m.conns:
            m.conns.remove(conn)
        self.touched = time.monotonic()
        self.broadcast()

    def close(self) -> None:
        pass

    def describe(self) -> str:
        return f"{self.id} · {self.scenario} · {sum(m.online for m in self.members.values())} online"

    # ------------------------------------------------------------- state
    def seat_of(self, member_id: str) -> str | None:
        mine = [s for s in SEATS if self.seats[s] == member_id]
        if len(mine) == 2:
            return None  # hot-seat: sees everything
        return mine[0] if mine else "spectator"

    def snapshot(self, member_id: str) -> dict[str, Any]:
        view = self.seat_of(member_id)
        base: dict[str, Any] = {
            "type": "state",
            "room": self.id,
            "you": member_id,
            "isHost": member_id == self.host,
            "scenario": self.scenario,
            "hotseat": self.hotseat,
            "seats": {s: self._seat_public(self.seats[s]) for s in SEATS},
            "mySeats": [s for s in SEATS if self.seats[s] == member_id],
            "status": "lobby" if self.game is None else ("over" if self.game.result else "playing"),
            "progress": self.progress.finished(),
            "now": int(time.time() * 1000),
        }
        if self.game is not None:
            base["game"] = self.game.view(None if view is None else (view if view in SEATS else "spectator"))
        return base

    def _seat_public(self, member_id: str | None) -> dict[str, Any] | None:
        m = self.members.get(member_id or "")
        return {"name": m.name, "online": m.online} if m else None

    def broadcast(self) -> None:
        for m in self.members.values():
            snap = self.snapshot(m.id)
            for conn in m.conns:
                conn.send(snap)

    # ------------------------------------------------------------- messages
    def handle(self, member_id: str, msg: dict[str, Any]) -> None:
        self.touched = time.monotonic()
        kind = msg.get("type")
        host = member_id == self.host
        if kind == "name":
            self.members[member_id].name = (str(msg.get("name", "")).strip()[:20]) or self.members[member_id].name
        elif kind == "scenario":
            self._need_lobby(host)
            if msg.get("id") not in BY_ID:
                raise RoomError("Unknown scenario")
            self.scenario = msg["id"]
        elif kind == "hotseat":
            self._need_lobby(host)
            self.hotseat = bool(msg.get("on"))
            for s in SEATS:
                self.seats[s] = None
            if self.hotseat:
                self.seats = dict.fromkeys(SEATS, member_id)
        elif kind == "claim":
            self._need_lobby(True)
            seat = msg.get("seat")
            if seat not in SEATS or self.hotseat:
                raise RoomError("Can't take that seat")
            if self.seats[seat] not in (None, member_id):
                raise RoomError("That seat is taken")
            for s in SEATS:
                if self.seats[s] == member_id:
                    self.seats[s] = None
            self.seats[seat] = member_id
        elif kind == "leave":
            self._need_lobby(True)
            for s in SEATS:
                if self.seats[s] == member_id:
                    self.seats[s] = None
        elif kind == "start":
            self._need_lobby(host)
            if any(self.seats[s] is None for s in SEATS):
                raise RoomError("Both the Pilot and the Co-Pilot seat need a player")
            self.game = Game(self.scenario, hotseat=self.hotseat)
            self.recorded = False
            self.deadline = None
        elif kind == "lobby":
            if not host:
                raise RoomError("Only the host can do that")
            self.game = None
            self.deadline = None
        elif kind == "act":
            self._act(member_id, msg)
        else:
            raise RoomError("Unknown message")
        self.broadcast()

    def _need_lobby(self, allowed: bool) -> None:
        if self.game is not None:
            raise RoomError("A flight is in progress")
        if not allowed:
            raise RoomError("Only the host can do that")

    def _act(self, member_id: str, msg: dict[str, Any]) -> None:
        if self.game is None:
            raise RoomError("No flight in progress")
        seat = msg.get("seat")
        if seat not in SEATS or self.seats[seat] != member_id:
            raise RoomError("That is not your seat")
        action = msg.get("action")
        if not isinstance(action, dict):
            raise RoomError("Bad action")
        try:
            self.game.apply(seat, action)
        except IllegalMove as e:
            raise RoomError(str(e)) from e
        self.after_game_change()

    def after_game_change(self) -> None:
        g = self.game
        if g is None:
            return
        if g.phase == "place" and "realtime" in g.mods:
            if self.deadline is None:
                self.deadline = time.monotonic() + REALTIME_SECONDS
                g.deadline_ms = int(time.time() * 1000) + REALTIME_SECONDS * 1000
        else:
            self.deadline = None
            g.deadline_ms = None
        if g.result is not None and not self.recorded:
            self.recorded = True
            self.progress.record(g.scenario.id, bool(g.result["won"]))

    def tick(self) -> None:
        if self.game and self.deadline and time.monotonic() >= self.deadline and not self.game.result:
            self.deadline = None
            try:
                self.game.apply("pilot", {"t": "timeout"})
            except IllegalMove:
                return
            self.after_game_change()
            self.broadcast()
