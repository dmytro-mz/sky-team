from __future__ import annotations

import re
import shutil
import socket
import subprocess
import time
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


def _start_tunnel(port: int) -> tuple[subprocess.Popen[str], str]:
    """Open a temporary public https://*.trycloudflare.com tunnel to the local server."""
    exe = shutil.which("cloudflared")
    if exe is None:
        raise typer.BadParameter("--tunnel needs cloudflared: `brew install cloudflared`")
    proc = subprocess.Popen(
        [exe, "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{port}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert proc.stderr is not None
    pattern = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
    deadline = time.time() + 30
    for line in proc.stderr:
        if match := pattern.search(line):
            return proc, match.group(0)
        if time.time() > deadline:
            break
    proc.terminate()
    raise typer.BadParameter("cloudflared did not report a public URL")


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
    tunnel: Annotated[bool, typer.Option(help="Open a public cloudflared tunnel so friends anywhere can join")] = False,
) -> None:
    """Host the web game. Open the link, pick a scenario, and fly."""
    import uvicorn

    from skyteam.progress import Progress
    from skyteam.web.server import create_app

    ip = _lan_ip() if host == "0.0.0.0" else None
    lan_url = f"http://{ip}:{port}" if ip else None
    proc = None
    if tunnel:
        with console.status("Opening a public tunnel…"):
            proc, public_url = _start_tunnel(port)
    console.print("[bold cyan]Sky Team server[/]")
    console.print(f"  local:    http://localhost:{port}")
    if lan_url:
        console.print(f"  network:  {lan_url}   (same Wi-Fi / LAN)")
    if public_url:
        console.print(f"  public:   {public_url}   (send this to your co-pilot)")
    else:
        console.print("[dim]  friends elsewhere? restart with --tunnel for a public link")
    console.print(f"  progress: {progress.resolve()}")
    try:
        uvicorn.run(
            create_app(Progress(progress), public_url=public_url, lan_url=lan_url),
            host=host,
            port=port,
            log_level="warning",
        )
    finally:
        if proc is not None:
            proc.terminate()


def main() -> None:
    app()
