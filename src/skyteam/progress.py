"""Local record of which scenarios have been landed. Lives in a gitignored `progress.json`."""

from __future__ import annotations

import json
import os
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


class Progress:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or Path(os.environ.get("SKYTEAM_PROGRESS", "progress.json"))
        self._lock = threading.Lock()

    def load(self) -> dict[str, Any]:
        try:
            data = json.loads(self.path.read_text())
        except (OSError, ValueError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        data.setdefault("scenarios", {})
        return data

    def record(self, scenario_id: str, won: bool) -> None:
        with self._lock:
            data = self.load()
            entry = data["scenarios"].setdefault(scenario_id, {"attempts": 0, "wins": 0})
            entry["attempts"] += 1
            now = datetime.now(UTC).isoformat(timespec="seconds")
            entry["last_played"] = now
            if won:
                entry["wins"] += 1
                entry.setdefault("first_win", now)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, indent=2))
            tmp.replace(self.path)

    def finished(self) -> dict[str, dict[str, Any]]:
        return self.load()["scenarios"]
