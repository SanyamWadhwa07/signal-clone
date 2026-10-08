from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SearchSvc
from app.schemas.search import SearchOut

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchOut)
async def search(
    user: CurrentUser, service: SearchSvc, q: str = Query(default="", max_length=100)
) -> SearchOut:
    return await service.search(user, q)
