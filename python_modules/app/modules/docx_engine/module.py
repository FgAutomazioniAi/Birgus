from __future__ import annotations

import base64
from typing import Any

from app.modules.base import PythonModule
from app.services.quotation_docx_service import QuotationDocxService


class DocxEngineModule(PythonModule):
    def __init__(self, quotation_docx_service: QuotationDocxService):
        self._quotation_docx_service = quotation_docx_service

    @property
    def name(self) -> str:
        return "docx_engine"

    def warmup(self) -> None:
        return

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action == "build_quotation_docx":
            return self._build_quotation_docx(payload)

        raise ValueError(f"Action non supportata per docx_engine: {action}")

    def _build_quotation_docx(self, payload: dict[str, Any]) -> dict[str, Any]:
        structured_data = payload.get("structured_data")
        if not isinstance(structured_data, dict):
            raise ValueError("Campo obbligatorio mancante o non valido: input.structured_data")

        file_name = str(payload.get("file_name", "preventivo.docx")).strip() or "preventivo.docx"
        print(f"[python_modules][docx_engine][start] action=build_quotation_docx file_name={file_name}")
        docx_bytes = self._quotation_docx_service.build_quotation_docx(structured_data)
        print(
            "[python_modules][docx_engine][done] "
            f"file_name={file_name} size_bytes={len(docx_bytes)}"
        )

        return {
          "file_name": file_name,
          "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "size_bytes": len(docx_bytes),
          "docx_base64": base64.b64encode(docx_bytes).decode("ascii"),
        }
