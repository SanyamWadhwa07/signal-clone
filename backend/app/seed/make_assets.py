"""Regenerate the demo images: `uv run python -m app.seed.make_assets`.

The PNGs are committed (small, ~10 KB each) so the server never has to draw them on boot.
"""

import time
from pathlib import Path

from app.seed.designs import all_assets

ASSETS_DIR = Path(__file__).parent / "assets"


def main() -> None:
    started = time.perf_counter()
    for relative, canvas in all_assets().items():
        target = ASSETS_DIR / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(canvas.png())
        print(f"wrote {relative} ({target.stat().st_size // 1024} KB)")
    print(f"done in {time.perf_counter() - started:.1f}s")


if __name__ == "__main__":
    main()
