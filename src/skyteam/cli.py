from __future__ import annotations

import socket
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console

app = typer.Typer(add_completion=False, help="Sky Team: the cooperative landing game")
console = Console()


def _lan_ip() -> str | None:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            ip = s.getsockname()[0]
        except OSError:
            return None
    return None if ip.startswith("127.") else ip


@app.callback()
def _root() -> None:
    """Sky Team: the cooperative landing game."""


@app.command()
def serve(
    host: Annotated[str, typer.Option(help="Interface to bind; 0.0.0.0 lets your LAN join")] = "0.0.0.0",
    port: int = 8000,
    progress: Annotated[Path, typer.Option(help="Local file that remembers finished scenarios")] = Path(
        "progress.json"
    ),
    public_url: Annotated[str | None, typer.Option(help="Base URL used in invite links")] = None,
) -> None:
    """Host the web game. Open the link, pick a scenario, and fly."""
    import uvicorn

    from skyteam.progress import Progress
    from skyteam.web.server import create_app

    ip = _lan_ip() if host == "0.0.0.0" else None
    lan_url = f"http://{ip}:{port}" if ip else None
    console.print("[bold cyan]Sky Team server[/]")
    console.print(f"  local:    http://localhost:{port}")
    if lan_url:
        console.print(f"  network:  {lan_url}   (same Wi-Fi / LAN)")
    console.print(f"  progress: {progress.resolve()}")
    uvicorn.run(
        create_app(Progress(progress), public_url=public_url, lan_url=lan_url),
        host=host,
        port=port,
        log_level="warning",
    )


def main() -> None:
    app()
