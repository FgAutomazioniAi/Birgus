from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.config import Settings
from app.services.ocr_engine_service import OcrEngineService
from app.services.paddle_ocr_service import PaddleOcrService
from app.services.storage_service import GarageStorageService


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings.from_env()
    ocr_service = OcrEngineService(GarageStorageService(settings), PaddleOcrService(settings))
    app.state.ocr_service = ocr_service
    ocr_service.start_warmup()
    yield


app = FastAPI(title="Birgus OCR Service", version="1.0.0", lifespan=lifespan)
app.include_router(router)
