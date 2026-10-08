from fastapi import APIRouter

from app.api.v1 import auth, contacts, conversations, groups, messages, search, uploads, users

api_router = APIRouter(prefix="/api/v1")
for module in (auth, users, contacts, conversations, groups, messages, uploads, search):
    api_router.include_router(module.router)
