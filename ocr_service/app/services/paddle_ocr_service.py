from __future__ import annotations

import os
import gc
from io import BytesIO
from pathlib import Path
from threading import RLock
from typing import Any

import numpy as np
import pypdfium2 as pdfium
from PIL import Image

from app.config import Settings


class PaddleOcrService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._ocr: Any = None
        self._lock = RLock()

    def unload(self) -> bool:
        with self._lock:
            if self._ocr is None:
                return False

            model = self._ocr
            self._ocr = None
            del model
            gc.collect()

            try:
                import paddle
                if paddle.is_compiled_with_cuda():
                    paddle.device.cuda.empty_cache()
            except Exception:
                pass

            return True

    def is_loaded(self) -> bool:
        with self._lock:
            return self._ocr is not None

    def warmup(self) -> None:
        self._get_ocr()

    def extract_text_from_pdf_bytes(self, pdf_bytes: bytes, max_pages: int | None = None) -> tuple[str, int]:
        ocr = self._get_ocr()
        page_texts: list[str] = []
        pdf = pdfium.PdfDocument(pdf_bytes)
        try:
            total_pages = len(pdf)
            capped_pages = total_pages if not max_pages or max_pages <= 0 else min(total_pages, max_pages)
            for page_index in range(capped_pages):
                page = pdf[page_index]
                bitmap = None
                try:
                    bitmap = page.render(scale=2)
                    prediction = ocr.predict(np.array(bitmap.to_pil().convert("RGB")))
                    lines = [str(value).strip() for item in prediction or [] for value in (item.get("rec_texts", []) if hasattr(item, "get") else []) if str(value).strip()]
                    page_texts.append(f"[PAGE {page_index + 1}]\n" + "\n".join(lines))
                finally:
                    if bitmap is not None and hasattr(bitmap, "close"):
                        bitmap.close()
                    if hasattr(page, "close"):
                        page.close()
        finally:
            if hasattr(pdf, "close"):
                pdf.close()
        return "\n\n".join(page_texts).strip(), len(page_texts)

    def extract_text_from_image_bytes(self, image_bytes: bytes) -> tuple[str, int]:
        prediction = self._get_ocr().predict(np.array(Image.open(BytesIO(image_bytes)).convert("RGB")))
        lines = [str(value).strip() for item in prediction or [] for value in (item.get("rec_texts", []) if hasattr(item, "get") else []) if str(value).strip()]
        return "[IMAGE 1]\n" + "\n".join(lines), 1

    def _get_ocr(self) -> Any:
        with self._lock:
            if self._ocr is not None:
                return self._ocr

            cache_dir = Path(self._settings.paddle_ocr_home)
            cache_dir.mkdir(parents=True, exist_ok=True)
            os.environ["PADDLEOCR_HOME"] = str(cache_dir)
            os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(cache_dir / "paddlex_cache"))
            os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
            try:
                from paddleocr import PaddleOCR
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError("PaddleOCR non disponibile nel container OCR. Verifica dipendenze e build.") from exc

            self._ocr = PaddleOCR(lang=self._settings.ocr_engine_lang)
            return self._ocr
