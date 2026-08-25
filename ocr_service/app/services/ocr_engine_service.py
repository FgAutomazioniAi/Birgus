from __future__ import annotations

import base64
from threading import Lock, Thread
from typing import Any

from app.services.paddle_ocr_service import PaddleOcrService
from app.services.storage_service import GarageStorageService


class OcrEngineService:
    def __init__(self, storage: GarageStorageService, ocr: PaddleOcrService):
        self._storage = storage
        self._ocr = ocr
        self._warmup_lock = Lock()
        self._warming_up = False
        self._warmup_error: str | None = None

    def unload_model(self) -> dict[str, bool]:
        return {
            "model_unloaded": self._ocr.unload(),
            "model_loaded": self._ocr.is_loaded(),
        }

    def start_warmup(self) -> None:
        with self._warmup_lock:
            if self._warming_up or self._ocr.is_loaded():
                return
            self._warming_up = True
            self._warmup_error = None

        Thread(target=self._warmup, name="ocr-model-warmup", daemon=True).start()

    def runtime_status(self) -> dict[str, str | bool | None]:
        with self._warmup_lock:
            if self._ocr.is_loaded():
                state = "ready"
            elif self._warming_up:
                state = "starting"
            elif self._warmup_error:
                state = "failed"
            else:
                state = "idle"

            return {
                "state": state,
                "model_loaded": self._ocr.is_loaded(),
                "error": self._warmup_error,
            }

    def _warmup(self) -> None:
        try:
            self._ocr.warmup()
        except Exception as exc:  # noqa: BLE001
            with self._warmup_lock:
                self._warmup_error = str(exc)
        finally:
            with self._warmup_lock:
                self._warming_up = False

    def extract_text(self, payload: dict[str, Any]) -> dict[str, Any]:
        storage_path = str(payload.get("storage_path", "")).strip()
        file_base64 = str(payload.get("file_base64") or payload.get("pdf_base64") or "").strip()
        content_type = str(payload.get("content_type", "")).strip().lower()
        if not storage_path and not file_base64:
            raise ValueError("Campo obbligatorio mancante: input.storage_path o input.file_base64")

        max_pages_value = payload.get("max_pages")
        max_pages = int(max_pages_value) if isinstance(max_pages_value, (int, float, str)) and str(max_pages_value).strip() else None
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

        return {
            "storage_path": storage_path,
            "file_name": str(payload.get("file_name", "")).strip() or None,
            "content_type": content_type or None,
            "extracted_text": extracted_text,
            "extracted_chars": len(extracted_text),
            "extracted_pages": extracted_pages,
        }
