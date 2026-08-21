from __future__ import annotations

import base64
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
        file_base64 = str(payload.get("file_base64") or payload.get("pdf_base64") or "").strip()
        content_type = str(payload.get("content_type", "")).strip().lower()
        if not storage_path and not file_base64:
            raise ValueError("Campo obbligatorio mancante: input.storage_path o input.file_base64")

        max_pages_value = payload.get("max_pages")
        max_pages = int(max_pages_value) if isinstance(max_pages_value, (int, float, str)) and str(max_pages_value).strip() else None

        print(f"[python_modules][ocr_engine][start] storage_path={storage_path or '<uploaded>'} max_pages={max_pages}")
        if storage_path:
            bytes_payload = self._storage.get_object_bytes_from_storage_path(storage_path)
        else:
            try:
                bytes_payload = base64.b64decode(file_base64)
            except Exception as exc:
                raise ValueError("Campo non valido: input.file_base64") from exc
        if content_type.startswith("image/"):
            extracted_text, extracted_pages = self._ocr.extract_text_from_image_bytes(bytes_payload)
        else:
            try:
                extracted_text, extracted_pages = self._ocr.extract_text_from_pdf_bytes(bytes_payload, max_pages=max_pages)
            except Exception:
                if storage_path:
                    raise
                extracted_text, extracted_pages = self._ocr.extract_text_from_image_bytes(bytes_payload)
        preview = extracted_text[:2500]
        print(
            f"[python_modules][ocr_engine][done] pages={extracted_pages} chars={len(extracted_text)} "
            f"ocr_preview_start\n{preview}\nocr_preview_end"
        )

        return {
            "storage_path": storage_path,
            "file_name": str(payload.get("file_name", "")).strip() or None,
            "content_type": content_type or None,
            "extracted_text": extracted_text,
            "extracted_chars": len(extracted_text),
            "extracted_pages": extracted_pages,
        }
