"""Original flat-style illustrations for the demo: people, group icons and photo-like scenes.

Drawn from scratch with `render.py` (no scraped or AI-generated likenesses of real people).
Run `uv run python -m app.seed.make_assets` to regenerate the PNGs in `assets/`.
"""

import math
from dataclasses import dataclass

from app.seed.render import (
    Canvas,
    Color,
    above,
    below,
    both,
    diagonal_gradient,
    ellipse,
    polygon,
    rect,
    rgb,
    ring,
    under_curve,
    vertical_gradient,
)

AVATAR_SIZE = 160
SCENE_SIZE = (320, 200)


# ----------------------------------------------------------------------------- people


@dataclass(frozen=True)
class Face:
    skin: str
    hair: str
    shirt: str
    bg: tuple[str, str]
    style: str  # short | long | bob | bun | turban | cap
    beard: bool = False
    glasses: bool = False
    accent: str = "#1f3a6b"  # turban or cap colour


def _darker(color: Color, factor: float = 0.82) -> Color:
    return int(color[0] * factor), int(color[1] * factor), int(color[2] * factor)


def face_canvas(face: Face, size: int = AVATAR_SIZE) -> Canvas:
    skin, hair, shirt = rgb(face.skin), rgb(face.hair), rgb(face.shirt)
    skin_dark = _darker(skin)
    dark = (35, 24, 21)
    head = ellipse(0.5, 0.44, 0.20, 0.245)

    feminine = face.style in ("long", "bob", "bun")

    c = Canvas(size, size)
    c.add(None, diagonal_gradient(rgb(face.bg[0]), rgb(face.bg[1])))

    # Hair behind the head goes first, so the neck and shoulders are painted over it. (Drawn after
    # the neck, long hair covered the chin and read as a beard.)
    if face.style == "long":
        c.add(ellipse(0.5, 0.52, 0.27, 0.37), hair)
    elif face.style == "bob":
        c.add(ellipse(0.5, 0.47, 0.26, 0.28), hair)

    c.add(ellipse(0.5, 1.02, 0.40, 0.27), shirt)  # shoulders
    c.add(rect(0.43, 0.58, 0.57, 0.80), skin_dark)  # neck
    c.add(polygon([(0.40, 0.76), (0.60, 0.76), (0.5, 0.90)]), skin_dark)  # collar opening

    c.add(ellipse(0.295, 0.46, 0.03, 0.045), skin)  # ears
    c.add(ellipse(0.705, 0.46, 0.03, 0.045), skin)
    if feminine:  # earrings
        gold = (232, 190, 84)
        c.add(ellipse(0.292, 0.53, 0.014, 0.02), gold)
        c.add(ellipse(0.708, 0.53, 0.014, 0.02), gold)
    c.add(head, skin)

    # hair in front
    if face.style in ("short", "bun"):
        c.add(both(ellipse(0.5, 0.36, 0.215, 0.19), above(0.40)), hair)
        c.add(ellipse(0.305, 0.42, 0.035, 0.08), hair)
        c.add(ellipse(0.695, 0.42, 0.035, 0.08), hair)
        if face.style == "bun":
            c.add(ellipse(0.5, 0.15, 0.08, 0.08), hair)
    elif face.style == "long":
        c.add(both(ellipse(0.5, 0.345, 0.225, 0.18), above(0.42)), hair)
    elif face.style == "bob":
        c.add(both(ellipse(0.5, 0.335, 0.235, 0.18), above(0.44)), hair)
    elif face.style == "turban":
        wrap, band = rgb(face.accent), _lighten(rgb(face.accent))
        c.add(ellipse(0.5, 0.18, 0.15, 0.11), wrap)
        c.add(both(ellipse(0.5, 0.31, 0.25, 0.20), above(0.43)), wrap)
        c.add(both(ellipse(0.5, 0.31, 0.25, 0.20), rect(0, 0.36, 1, 0.385)), band)
    elif face.style == "cap":
        cap = rgb(face.accent)
        c.add(both(ellipse(0.5, 0.31, 0.225, 0.18), above(0.385)), cap)
        c.add(both(ellipse(0.5, 0.39, 0.31, 0.05), below(0.36)), _darker(cap, 0.85))

    if face.beard:
        jaw = both(both(head, below(0.54)), lambda x, y: not ellipse(0.5, 0.56, 0.10, 0.065)(x, y))
        c.add(jaw, hair)
        c.add(ellipse(0.5, 0.56, 0.10, 0.065), skin)

    # eyes, brows, nose, mouth
    c.add(ellipse(0.42, 0.44, 0.017, 0.025), dark)
    c.add(ellipse(0.58, 0.44, 0.017, 0.025), dark)
    if feminine:  # lash flicks at the outer corners
        c.add(ellipse(0.39, 0.425, 0.014, 0.007), dark)
        c.add(ellipse(0.61, 0.425, 0.014, 0.007), dark)
    c.add(rect(0.37, 0.385, 0.47, 0.397), hair if face.style != "turban" else dark)
    c.add(rect(0.53, 0.385, 0.63, 0.397), hair if face.style != "turban" else dark)
    c.add(ellipse(0.5, 0.505, 0.02, 0.014), skin_dark)
    c.add(
        lambda x, y: y >= 0.55 and 0.5 <= ((x - 0.5) / 0.085) ** 2 + ((y - 0.55) / 0.05) ** 2 <= 1,
        (176, 58, 84) if feminine else (140, 59, 46),
    )
    if face.glasses:
        for cx in (0.42, 0.58):
            c.add(ring(cx, 0.44, 0.058, 0.014), (40, 40, 50))
        c.add(rect(0.475, 0.435, 0.525, 0.447), (40, 40, 50))
    return c


def _lighten(color: Color) -> Color:
    return tuple(min(255, int(v + (255 - v) * 0.35)) for v in color)  # type: ignore[return-value]


FACES: dict[str, Face] = {
    "sanyam": Face("#d9a06b", "#17130f", "#1e3a5f", ("#7aa7f7", "#2c6bed"), "short"),
    "aarav": Face("#b97a4a", "#1b1410", "#c0392b", ("#ffb36b", "#ff7e5f"), "short"),
    "simran": Face("#e9bf98", "#1a1210", "#0f7b6c", ("#ffc2d6", "#f783ac"), "long"),
    "harpreet": Face(
        "#c68a5c",
        "#1b130e",
        "#2d6a4f",
        ("#95d5b2", "#40916c"),
        "turban",
        beard=True,
        accent="#1f3a6b",
    ),
    "ishita": Face("#d9a06b", "#4a2c1a", "#e9a820", ("#cdb4f6", "#8e6ee0"), "bob", glasses=True),
    "tanvi": Face("#e0a878", "#201512", "#8b2635", ("#8de0d0", "#1d8663"), "bun"),
    "rohan": Face(
        "#9a6038", "#120d0a", "#3b7845", ("#aab4c4", "#5c6b80"), "cap", beard=True, accent="#222a35"
    ),
    "neha": Face("#eec7a0", "#2a1a12", "#6a4c93", ("#e0d4f5", "#b79ced"), "long"),
    "anita": Face("#d7a070", "#3a2a22", "#d9531e", ("#ffe3b3", "#f6b26b"), "bun"),
    "dhruv": Face("#c68a5c", "#241811", "#475569", ("#9bd0e0", "#4a8fa8"), "short", glasses=True),
    "arjun": Face(
        "#a8693f", "#15100c", "#1d4ed8", ("#b7e4c7", "#52b788"), "cap", beard=True, accent="#1d4ed8"
    ),
    "kriti": Face("#e2b48a", "#1f1612", "#b5446e", ("#ffd6a5", "#fb8c5a"), "bob"),
}


# ----------------------------------------------------------------------------- scenes


def _ridge(base: float, amp1: float, f1: float, amp2: float, f2: float, phase: float):
    return lambda x: base + amp1 * math.sin(f1 * x + phase) + amp2 * math.sin(f2 * x + phase * 1.7)


def mountains(width: int, height: int, sky: tuple[str, str], sun: str, ridges: list[str]) -> Canvas:
    aspect = width / height
    c = Canvas(width, height)
    c.add(None, vertical_gradient(rgb(sky[0]), rgb(sky[1])))
    c.add(ellipse(0.68, 0.40, 0.075 / aspect * 1.6, 0.12), rgb(sun))
    specs = [
        (0.60, 0.07, 5.0, 0.04, 11.0, 0.5),
        (0.70, 0.07, 4.0, 0.04, 9.0, 2.0),
        (0.82, 0.05, 3.0, 0.03, 8.0, 1.0),
    ]
    for color, spec in zip(ridges, specs, strict=False):
        c.add(under_curve(_ridge(*spec)), rgb(color))
    return c


def city_night(width: int, height: int) -> Canvas:
    c = Canvas(width, height)
    c.add(None, vertical_gradient(rgb("#0b1026"), rgb("#33205c")))
    c.add(
        lambda x, y: y < 0.55 and (int(x * 160) * 73856093 ^ int(y * 100) * 19349663) % 61 == 0,
        rgb("#f4f1de"),
    )
    c.add(ellipse(0.82, 0.2, 0.04, 0.07), rgb("#f3e9c6"))
    buildings = [
        (0.02, 0.18, 0.52),
        (0.16, 0.30, 0.38),
        (0.28, 0.42, 0.58),
        (0.40, 0.58, 0.30),
        (0.56, 0.68, 0.50),
        (0.66, 0.80, 0.40),
        (0.78, 0.98, 0.55),
    ]
    for x0, x1, top in buildings:
        body = rect(x0, top, x1, 1.0)
        c.add(body, rgb("#12183a"))
        c.add(
            both(
                body,
                lambda x, y, t=top: y > t + 0.05 and int(x * 90) % 3 == 0 and int(y * 60) % 3 == 0,
            ),
            rgb("#ffd97a"),
        )
    return c


def chai(width: int, height: int) -> Canvas:
    c = Canvas(width, height)
    c.add(None, diagonal_gradient(rgb("#f9dcae"), rgb("#e29a5b")))
    c.add(ellipse(0.5, 0.80, 0.26, 0.055), rgb("#f1e7da"))
    c.add(polygon([(0.37, 0.46), (0.63, 0.46), (0.59, 0.77), (0.41, 0.77)]), rgb("#fbf6ee"))
    c.add(ellipse(0.5, 0.47, 0.13, 0.035), rgb("#a86a3d"))
    c.add(ring(0.655, 0.58, 0.05, 0.016), rgb("#fbf6ee"))
    for k in range(3):
        c.add(
            lambda x, y, k=k: (
                0.16 < y < 0.42
                and abs(x - (0.44 + 0.06 * k + 0.012 * math.sin(y * 38 + k))) < 0.006
            ),
            rgb("#fffaf0"),
        )
    return c


def lagoon(width: int, height: int) -> Canvas:
    c = Canvas(width, height)
    c.add(None, diagonal_gradient(rgb("#077d92"), rgb("#2c6bed")))
    c.add(ellipse(0.72, 0.30, 0.06, 0.10), rgb("#ffe9a8"))
    c.add(lambda x, y: y > 0.5 and math.sin((y - 0.5) * 70 + x * 6) > 0.55, rgb("#8fd3e6"))
    return c


def _scene(kind: str) -> Canvas:
    w, h = SCENE_SIZE
    if kind == "sunset":
        return mountains(w, h, ("#35458c", "#f4a261"), "#ffe29a", ["#6c5b9e", "#3d4a8a", "#1f2a52"])
    if kind == "dawn":
        return mountains(w, h, ("#7aa7d9", "#fbd3a1"), "#fff2c4", ["#7d9a8c", "#4f7a64", "#2f5446"])
    if kind == "city":
        return city_night(w, h)
    if kind == "chai":
        return chai(w, h)
    if kind == "lagoon":
        return lagoon(w, h)
    raise KeyError(kind)


# ----------------------------------------------------------------------------- group icons


def _group_icon(kind: str, size: int = AVATAR_SIZE) -> Canvas:
    c = Canvas(size, size)
    if kind == "kasauli":
        return mountains(
            size, size, ("#4a6fa5", "#f5c38e"), "#fff2c4", ["#6f8f9d", "#3d6b5a", "#264a3c"]
        )
    if kind == "hackathon":
        c.add(None, vertical_gradient(rgb("#2b1055"), rgb("#7597de")))
        for sx, sy in [(0.15, 0.2), (0.82, 0.15), (0.75, 0.55), (0.2, 0.7), (0.9, 0.8)]:
            c.add(ellipse(sx, sy, 0.012, 0.012), rgb("#ffffff"))
        c.add(polygon([(0.39, 0.55), (0.28, 0.76), (0.42, 0.70)]), rgb("#e63946"))
        c.add(polygon([(0.61, 0.55), (0.72, 0.76), (0.58, 0.70)]), rgb("#e63946"))
        c.add(polygon([(0.45, 0.70), (0.55, 0.70), (0.5, 0.88)]), rgb("#ffb703"))
        c.add(ellipse(0.5, 0.45, 0.115, 0.27), rgb("#f1f2f6"))
        c.add(ellipse(0.5, 0.40, 0.05, 0.05), rgb("#4aa3df"))
    elif kind == "interns":
        c.add(None, diagonal_gradient(rgb("#1d3557"), rgb("#457b9d")))
        c.add(
            polygon(
                [(0.30, 0.52), (0.5, 0.63), (0.70, 0.52), (0.70, 0.68), (0.5, 0.78), (0.30, 0.68)]
            ),
            rgb("#1b1b1f"),
        )
        c.add(polygon([(0.5, 0.27), (0.90, 0.46), (0.5, 0.65), (0.10, 0.46)]), rgb("#26262c"))
        c.add(rect(0.83, 0.46, 0.845, 0.66), rgb("#ffd166"))
        c.add(ellipse(0.838, 0.69, 0.022, 0.035), rgb("#ffd166"))
    elif kind == "hostel":
        c.add(None, vertical_gradient(rgb("#ffe8d6"), rgb("#ffb4a2")))
        c.add(rect(0.25, 0.48, 0.75, 0.82), rgb("#e5989b"))
        c.add(polygon([(0.18, 0.50), (0.5, 0.22), (0.82, 0.50)]), rgb("#6d6875"))
        c.add(rect(0.45, 0.62, 0.55, 0.82), rgb("#b5838d"))
        c.add(rect(0.30, 0.55, 0.40, 0.65), rgb("#ffcb69"))
        c.add(rect(0.60, 0.55, 0.70, 0.65), rgb("#ffcb69"))
    elif kind == "cricket":
        c.add(None, vertical_gradient(rgb("#386641"), rgb("#a7c957")))
        ball = ellipse(0.5, 0.5, 0.27, 0.27)
        c.add(ball, rgb("#b5232d"))
        c.add(
            both(ball, lambda x, y: abs((x - 0.5) - 0.13 * math.sin((y - 0.5) * 9)) < 0.013),
            rgb("#f1e9d2"),
        )
    elif kind == "batch":
        c.add(None, diagonal_gradient(rgb("#3a0ca3"), rgb("#7209b7")))
        c.add(rect(0.22, 0.62, 0.78, 0.73), rgb("#f72585"))
        c.add(rect(0.26, 0.51, 0.74, 0.62), rgb("#4cc9f0"))
        c.add(rect(0.30, 0.40, 0.70, 0.51), rgb("#ffd60a"))
        c.add(rect(0.34, 0.29, 0.66, 0.40), rgb("#80ed99"))
    else:
        raise KeyError(kind)
    return c


# ----------------------------------------------------------------------------- catalogue

SCENES = ["sunset", "dawn", "city", "chai", "lagoon"]
GROUP_ICONS = ["kasauli", "hackathon", "interns", "hostel", "cricket", "batch"]


def all_assets() -> dict[str, Canvas]:
    """Relative path (inside assets/) -> canvas."""
    assets: dict[str, Canvas] = {}
    for key, face in FACES.items():
        assets[f"avatars/{key}.png"] = face_canvas(face)
    for kind in GROUP_ICONS:
        assets[f"groups/{kind}.png"] = _group_icon(kind)
    for kind in SCENES:
        assets[f"scenes/{kind}.png"] = _scene(kind)
    return assets
