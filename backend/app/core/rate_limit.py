import math
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

from app.core.config import Settings
from app.core.errors import AppError

_PRUNE_THRESHOLD = 10_000


class RateLimiter:
    """Sliding-window limiter: at most `limit` hits per `window` seconds for each key.

    In-memory and per process, which matches the single-worker deployment (see README, "Assumptions").
    The `clock` is injectable so tests don't need to sleep.
    """

    def __init__(
        self,
        limit: int,
        window_seconds: float = 60.0,
        *,
        enabled: bool = True,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limit = limit
        self.window = window_seconds
        self.enabled = enabled
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> None:
        """Record a hit for `key`, or raise 429 with a Retry-After header when over the limit."""
        if not self.enabled:
            return
        now = self._clock()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            retry_after = max(1, math.ceil(self.window - (now - hits[0])))
            raise AppError(
                429,
                "rate_limited",
                "Too many requests. Please slow down and try again shortly.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        if len(self._hits) > _PRUNE_THRESHOLD:
            self._prune(now)

    def _prune(self, now: float) -> None:
        """Forget keys whose window has fully elapsed so the table can't grow without bound."""
        for key in [k for k, v in self._hits.items() if not v or now - v[-1] >= self.window]:
            del self._hits[key]


@dataclass(frozen=True)
class Limiters:
    """One limiter per abuse surface, so a chatty user can't lock themselves out of logging in."""

    auth: RateLimiter
    send: RateLimiter
    upload: RateLimiter

    @classmethod
    def from_settings(cls, settings: Settings) -> "Limiters":
        enabled = settings.rate_limit_enabled
        return cls(
            auth=RateLimiter(settings.rate_limit_auth_per_minute, enabled=enabled),
            send=RateLimiter(settings.rate_limit_send_per_minute, enabled=enabled),
            upload=RateLimiter(settings.rate_limit_upload_per_minute, enabled=enabled),
        )
