"""FastAPI application entry point. Run with: uvicorn app.main:app --port 8000"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_db
from .ml.model import ensure_trained
from .routers.api import router
from .seed import seed
from .services import intel
from .workers import ct_watch

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_db()
    seed()
    ensure_trained()
    intel.load_cached_feed()
    stop = ct_watch.start() if settings.enable_ct_watch else None
    yield
    if stop:
        stop.set()


app = FastAPI(title="TruthShield API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)
