from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.deps import AttachmentSvc, Container, CurrentUser, limit_upload
from app.schemas.message import AttachmentOut

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post(
    "",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_upload)],
)
async def upload(
    user: CurrentUser,
    service: AttachmentSvc,
    container: Container,
    file: UploadFile = File(...),
) -> AttachmentOut:
    # Read one byte past the cap so the service can reject oversize files without buffering them all.
    data = await file.read(container.settings.max_upload_bytes + 1)
    return await service.upload(user, file.filename or "file", file.content_type, data)
