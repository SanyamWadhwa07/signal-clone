from fastapi import APIRouter, Depends, Header, Response, status

from app.api.deps import AuthSvc, CurrentUser, Token, limit_auth
from app.schemas.auth import AuthResponse, PhoneRequest, RequestOtpResponse, VerifyOtpRequest
from app.schemas.user import UserMe
from app.services.presenters import user_me

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp", response_model=RequestOtpResponse, dependencies=[Depends(limit_auth)])
async def request_otp(body: PhoneRequest, auth: AuthSvc) -> RequestOtpResponse:
    return RequestOtpResponse(phone=body.phone, hint=auth.request_otp(body.phone))


@router.post("/verify-otp", response_model=AuthResponse, dependencies=[Depends(limit_auth)])
async def verify_otp(
    body: VerifyOtpRequest, auth: AuthSvc, user_agent: str | None = Header(default=None)
) -> AuthResponse:
    token, user, _ = await auth.verify_otp(body.phone, body.code, user_agent)
    return AuthResponse(token=token, user=user_me(user), needs_profile=user.first_name is None)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(token: Token, auth: AuthSvc) -> Response:
    await auth.logout(token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserMe)
async def me(user: CurrentUser) -> UserMe:
    return user_me(user)
