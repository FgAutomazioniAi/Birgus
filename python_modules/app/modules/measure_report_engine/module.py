from __future__ import annotations

from pathlib import Path
from typing import Any

from app.modules.base import PythonModule
from app.services.measure_report_engine_service import MeasureReportEngineService
from app.services.storage_service import GarageStorageService


class MeasureReportEngineModule(PythonModule):
    def __init__(self, storage: GarageStorageService, measure_report_engine_service: MeasureReportEngineService):
        self._storage = storage
        self._service = measure_report_engine_service

    @property
    def name(self) -> str:
        return "measure_report_engine"

    def warmup(self) -> None:
        return None

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action in {"prepare_out_of_tolerance_candidates_storage", "analyze_out_of_tolerance_storage"}:
            return self._prepare_out_of_tolerance_candidates_storage(payload)

        raise ValueError(f"Action non supportata per measure_report_engine: {action}")

    def _prepare_out_of_tolerance_candidates_storage(self, payload: dict[str, Any]) -> dict[str, Any]:
        storage_path = str(payload.get("storage_path", "")).strip()
        if not storage_path:
            raise ValueError("Campo obbligatorio mancante: input.storage_path")

        file_name = str(payload.get("file_name", "")).strip() or Path(storage_path).name or "measure-report.pdf"
        document_type = str(payload.get("document_type", "auto")).strip() or "auto"

        print(
            f"[python_modules][measure_report_engine][prepare:start] storage_path={storage_path} "
            f"file_name={file_name} document_type={document_type}"
        )
        bytes_payload = self._storage.get_object_bytes_from_storage_path(storage_path)
        result = self._service.prepare_pdf_bytes(
            pdf_bytes=bytes_payload,
            file_name=file_name,
            document_type=document_type,
        )
        print(
            f"[python_modules][measure_report_engine][prepare:done] candidates="
            f"{len(result.get('candidates', []))} document_type={result.get('document_type_used')}"
        )
        return result
