from __future__ import annotations

from typing import Any

from app.modules.base import PythonModule
from app.services.paddle_ocr_service import PaddleOcrService
from app.services.storage_service import GarageStorageService


class OcrEngineModule(PythonModule):
    def __init__(self, storage: GarageStorageService, ocr: PaddleOcrService):
        self._storage = storage
        self._ocr = ocr

    @property
    def name(self) -> str:
        return "ocr_engine"

    def warmup(self) -> None:
        self._ocr.warmup()

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action == "extract_text_from_pdf_storage":
            return self._extract_text_from_pdf_storage(payload)

        raise ValueError(f"Action non supportata per ocr_engine: {action}")

    def _extract_text_from_pdf_storage(self, payload: dict[str, Any]) -> dict[str, Any]:
        storage_path = str(payload.get("storage_path", "")).strip()
        if not storage_path:
            raise ValueError("Campo obbligatorio mancante: input.storage_path")

        max_pages_value = payload.get("max_pages")
        max_pages = int(max_pages_value) if isinstance(max_pages_value, (int, float, str)) and str(max_pages_value).strip() else None

        print(f"[python_modules][ocr_engine][start] storage_path={storage_path} max_pages={max_pages}")
        bytes_payload = self._storage.get_object_bytes_from_storage_path(storage_path)
        extracted_text, extracted_pages = self._ocr.extract_text_from_pdf_bytes(bytes_payload, max_pages=max_pages)
        preview = extracted_text[:2500]
        print(
            f"[python_modules][ocr_engine][done] pages={extracted_pages} chars={len(extracted_text)} "
            f"ocr_preview_start\n{preview}\nocr_preview_end"
        )

        return {
            "storage_path": storage_path,
            "extracted_text": extracted_text,
            "extracted_chars": len(extracted_text),
            "extracted_pages": extracted_pages,
        }
