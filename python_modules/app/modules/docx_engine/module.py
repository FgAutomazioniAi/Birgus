from __future__ import annotations

import base64
from typing import Any

from app.modules.base import PythonModule
from app.services.generic_document_service import GenericDocumentService
from app.services.quotation_docx_service import QuotationDocxService


class DocxEngineModule(PythonModule):
    def __init__(self, quotation_docx_service: QuotationDocxService):
        self._quotation_docx_service = quotation_docx_service
        self._generic_document_service = GenericDocumentService()

    @property
    def name(self) -> str:
        return "docx_engine"

    def warmup(self) -> None:
        return

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action == "build_quotation_docx":
            return self._build_quotation_docx(payload)
        if action == "generate_document":
            return self._generate_document(payload)

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

    def _generate_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        content = payload.get("content")
        if content is None:
            raise ValueError("Campo obbligatorio mancante: input.content")

        output_format = str(payload.get("format") or "docx").strip().lower()
        title = self._to_optional_string(payload.get("title"))
        file_name = str(payload.get("file_name") or payload.get("filename") or self._default_file_name(title, output_format)).strip()
        if not file_name:
            file_name = self._default_file_name(title, output_format)

        if "." not in file_name:
            file_name = f"{file_name}.{output_format}"

        document_bytes, content_type = self._generic_document_service.generate(
            content=content,
            title=title,
            output_format=output_format,
        )

        return {
            "file_name": file_name,
            "content_type": content_type,
            "size_bytes": len(document_bytes),
            "document_base64": base64.b64encode(document_bytes).decode("ascii"),
        }

    def _default_file_name(self, title: str | None, output_format: str) -> str:
        base = (title or "documento").strip().lower()
        safe = "".join(character if character.isalnum() else "-" for character in base).strip("-") or "documento"
        return f"{safe}.{output_format}"

    def _to_optional_string(self, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        normalized = value.strip()
        return normalized or None
