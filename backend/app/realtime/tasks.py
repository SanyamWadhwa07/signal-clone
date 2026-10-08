import asyncio
import logging
from datetime import timedelta

from app.models.base import utcnow
from app.services.container import ServiceContainer

logger = logging.getLogger(__name__)

ORPHAN_UPLOAD_MAX_AGE = timedelta(hours=1)
ORPHAN_SWEEP_EVERY_N_TICKS = 60


async def maintenance_loop(container: ServiceContainer) -> None:
    """Background upkeep: expire disappearing messages promptly, sweep abandoned uploads."""
    interval = container.settings.purge_interval_seconds
    ticks = 0
    while True:
        await asyncio.sleep(interval)
        ticks += 1
        try:
            async with container.session_factory() as session:
                await container.messages(session).purge_expired()
            if ticks % ORPHAN_SWEEP_EVERY_N_TICKS == 0:
                async with container.session_factory() as session:
                    await container.attachments(session).purge_orphans(
                        utcnow() - ORPHAN_UPLOAD_MAX_AGE
                    )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Maintenance tick failed")
