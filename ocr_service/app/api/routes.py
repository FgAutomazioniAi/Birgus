from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.models import ExecuteModuleRequest, ExecuteModuleResponse
from app.services.ocr_engine_service import OcrEngineService

router = APIRouter(prefix="/v1", tags=["ocr"])
logger = logging.getLogger(__name__)


def _ocr_service(request: Request) -> OcrEngineService:
    return request.app.state.ocr_service


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/runtime/unload")
def unload_runtime(request: Request) -> dict[str, bool]:
    return _ocr_service(request).unload_model()


@router.get("/runtime/status")
def runtime_status(request: Request) -> dict[str, str | bool | None]:
    return _ocr_service(request).runtime_status()


@router.post("/modules/execute", response_model=ExecuteModuleResponse)
def execute_module(payload: ExecuteModuleRequest, request: Request) -> ExecuteModuleResponse:
    if payload.module != "ocr_engine":
        raise HTTPException(status_code=400, detail=f"Modulo non supportato dal servizio OCR: {payload.module}")
    if payload.action != "extract_text_from_pdf_storage":
        raise HTTPException(status_code=400, detail=f"Azione non supportata per ocr_engine: {payload.action}")

    try:
        output = _ocr_service(request).extract_text(payload.input)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("OCR execution failed")
        raise HTTPException(status_code=500, detail="Errore interno del servizio OCR.") from exc

    return ExecuteModuleResponse(module=payload.module, action=payload.action, output=output)
