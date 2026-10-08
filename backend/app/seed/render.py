"""A tiny, dependency-free vector-ish rasterizer used to draw the demo avatars and photos.

Shapes are predicates over normalised coordinates (0..1 on both axes), painted in order, with 2x2
supersampling for smooth edges. It exists so the seed data can ship distinct profile pictures
without scraping photos of real people or adding an imaging library.
"""

import struct
import zlib
from collections.abc import Callable
from dataclasses import dataclass

Color = tuple[int, int, int]
Shape = Callable[[float, float], bool]
Paint = Color | Callable[[float, float], Color]


def rgb(value: str) -> Color:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


# ----------------------------------------------------------------------------- shapes


def ellipse(cx: float, cy: float, rx: float, ry: float) -> Shape:
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def rect(x0: float, y0: float, x1: float, y1: float) -> Shape:
    return lambda x, y: x0 <= x <= x1 and y0 <= y <= y1


def ring(cx: float, cy: float, radius: float, thickness: float) -> Shape:
    return lambda x, y: abs(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 - radius) <= thickness / 2


def polygon(points: list[tuple[float, float]]) -> Shape:
    """Even-odd point-in-polygon test."""

    def inside(x: float, y: float) -> bool:
        hit = False
        j = len(points) - 1
        for i, (xi, yi) in enumerate(points):
            xj, yj = points[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                hit = not hit
            j = i
        return hit

    return inside


def both(a: Shape, b: Shape) -> Shape:
    return lambda x, y: a(x, y) and b(x, y)


def either(a: Shape, b: Shape) -> Shape:
    return lambda x, y: a(x, y) or b(x, y)


def below(y0: float) -> Shape:
    return lambda _x, y: y >= y0


def above(y1: float) -> Shape:
    return lambda _x, y: y <= y1


def under_curve(curve: Callable[[float], float]) -> Shape:
    """Everything at or below y = curve(x) (used for hills and ridgelines)."""
    return lambda x, y: y >= curve(x)


# ----------------------------------------------------------------------------- paints


def vertical_gradient(top: Color, bottom: Color) -> Callable[[float, float], Color]:
    def paint(_x: float, y: float) -> Color:
        t = max(0.0, min(1.0, y))
        return (
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
        )

    return paint


def diagonal_gradient(a: Color, b: Color) -> Callable[[float, float], Color]:
    def paint(x: float, y: float) -> Color:
        t = max(0.0, min(1.0, (x + y) / 2))
        return (
            int(a[0] + (b[0] - a[0]) * t),
            int(a[1] + (b[1] - a[1]) * t),
            int(a[2] + (b[2] - a[2]) * t),
        )

    return paint


# ----------------------------------------------------------------------------- canvas


@dataclass
class Layer:
    shape: Shape | None  # None = fill everything
    paint: Paint


class Canvas:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.layers: list[Layer] = []

    def add(self, shape: Shape | None, paint: Paint) -> "Canvas":
        self.layers.append(Layer(shape, paint))
        return self

    def _sample(self, x: float, y: float) -> Color:
        color: Color = (255, 255, 255)
        for layer in self.layers:
            if layer.shape is None or layer.shape(x, y):
                paint = layer.paint
                color = paint(x, y) if callable(paint) else paint
        return color

    def png(self, supersample: int = 2) -> bytes:
        offsets = [(i + 0.5) / supersample for i in range(supersample)]
        count = supersample * supersample

        def pixel(px: int, py: int) -> Color:
            r = g = b = 0
            for oy in offsets:
                for ox in offsets:
                    cr, cg, cb = self._sample((px + ox) / self.width, (py + oy) / self.height)
                    r += cr
                    g += cg
                    b += cb
            return r // count, g // count, b // count

        return encode_png(self.width, self.height, pixel)


def _chunk(kind: bytes, data: bytes) -> bytes:
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))


def encode_png(width: int, height: int, pixel: Callable[[int, int], Color]) -> bytes:
    rows = b"".join(
        b"\x00" + b"".join(bytes(pixel(x, y)) for x in range(width)) for y in range(height)
    )
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(rows, 9))
        + _chunk(b"IEND", b"")
    )
