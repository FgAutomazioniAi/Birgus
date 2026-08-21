from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
import pypdfium2 as pdfium
from PIL import Image

from app.config import Settings


class PaddleOcrService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._ocr: Any = None

    def warmup(self) -> None:
        _ = self._get_ocr()

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
                    image = bitmap.to_pil().convert("RGB")
                    image_np = np.array(image)

                    prediction = ocr.predict(image_np)
                    lines: list[str] = []

                    if prediction:
                        for item in prediction:
                            rec_texts = item.get("rec_texts", []) if hasattr(item, "get") else []
                            for value in rec_texts:
                                cleaned = str(value).strip()
                                if cleaned:
                                    lines.append(cleaned)

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
        ocr = self._get_ocr()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        prediction = ocr.predict(image_np)
        lines: list[str] = []

        if prediction:
            for item in prediction:
                rec_texts = item.get("rec_texts", []) if hasattr(item, "get") else []
                for value in rec_texts:
                    cleaned = str(value).strip()
                    if cleaned:
                        lines.append(cleaned)

        return "[IMAGE 1]\n" + "\n".join(lines), 1

    def _get_ocr(self) -> Any:
        if self._ocr is not None:
            return self._ocr

        cache_dir = Path(self._settings.paddle_ocr_home)
        cache_dir.mkdir(parents=True, exist_ok=True)
        os.environ["PADDLEOCR_HOME"] = str(cache_dir)
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

        try:
            from paddleocr import PaddleOCR
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(
                "PaddleOCR non disponibile nel container python_modules. Verifica dipendenze e build."
            ) from exc

        self._ocr = PaddleOCR(lang=self._settings.ocr_engine_lang)
        return self._ocr
