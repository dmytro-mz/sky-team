"""HTTP + WebSocket server. Tables live in memory; anyone with the link can join."""

from __future__ import annotations

import asyncio
import contextlib
import secrets
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from skyteam.game.scenarios import ABILITIES, DIFFICULTIES, SCENARIOS
from skyteam.progress import Progress
from skyteam.web.room import Room, RoomError

STATIC = Path(__file__).parent / "static"
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOM_TTL = 3 * 3600.0
MAX_ROOMS = 200


class RevalidatedStatic(StaticFiles):
    def file_response(self, *args: Any, **kwargs: Any) -> Any:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response


class Connection:
    def __init__(self, ws: WebSocket, member_id: str) -> None:
        self.ws = ws
        self.member_id = member_id
        self.queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    def send(self, message: dict[str, Any]) -> None:
        if self.queue.qsize() < 200:
            self.queue.put_nowait(message)

    async def pump(self) -> None:
        while True:
            await self.ws.send_json(await self.queue.get())


def create_app(progress: Progress | None = None, public_url: str | None = None, lan_url: str | None = None) -> FastAPI:
    progress = progress or Progress()
    rooms: dict[str, Room] = {}

    async def sweep() -> None:
        while True:
            await asyncio.sleep(0.5)
            for code, room in list(rooms.items()):
                if room.idle_for > ROOM_TTL:
                    rooms.pop(code, None)
                else:
                    room.tick()

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        task = asyncio.create_task(sweep())
        yield
        task.cancel()

    app = FastAPI(title="Sky Team", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.rooms = rooms

    @app.get("/api/config")
    async def config() -> dict[str, Any]:
        return {
            "public_url": public_url,
            "lan_url": lan_url,
            "scenarios": [s.public() for s in SCENARIOS],
            "levels": DIFFICULTIES,
            "abilities": {k: {"name": v[0], "text": v[1]} for k, v in ABILITIES.items()},
            "progress": progress.finished(),
        }

    @app.post("/api/rooms")
    async def create_room() -> dict[str, str]:
        if len(rooms) >= MAX_ROOMS:
            raise HTTPException(503, "Too many tables open")
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(5))
            if code not in rooms:
                break
        rooms[code] = Room(code, progress)
        return {"room": code}

    @app.get("/api/rooms/{code}")
    async def room_info(code: str) -> dict[str, Any]:
        if code.upper() not in rooms:
            raise HTTPException(404, "No table with that code")
        return {"room": code.upper()}

    @app.websocket("/ws/{code}")
    async def websocket(ws: WebSocket, code: str) -> None:
        await ws.accept()
        room = rooms.get(code.upper())
        if room is None:
            await ws.send_json({"type": "fatal", "message": "This table doesn't exist (anymore)."})
            await ws.close()
            return
        try:
            hello = await ws.receive_json()
        except (WebSocketDisconnect, ValueError):
            return
        token = hello.get("token") if isinstance(hello, dict) else None
        if not isinstance(token, str) or not 16 <= len(token) <= 64:
            await ws.send_json({"type": "fatal", "message": "Bad handshake"})
            await ws.close()
            return
        member = room.join(token, hello.get("name"))
        conn = Connection(ws, member.id)
        pump = asyncio.create_task(conn.pump())
        room.connect(conn)
        try:
            while True:
                msg = await ws.receive_json()
                if not isinstance(msg, dict):
                    continue
                try:
                    room.handle(member.id, msg)
                except RoomError as e:
                    conn.send({"type": "error", "message": str(e)})
        except (WebSocketDisconnect, ValueError, RuntimeError):
            pass
        finally:
            room.disconnect(conn)
            pump.cancel()

    @app.get("/")
    @app.get("/r/{code}")
    async def index(code: str | None = None) -> FileResponse:
        return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})

    app.mount("/static", RevalidatedStatic(directory=STATIC), name="static")
    return app
