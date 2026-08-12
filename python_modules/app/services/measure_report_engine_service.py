from __future__ import annotations

import base64
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pypdfium2 as pdfium
from PIL import Image

from app.config import Settings

DOCUMENT_TYPE_CHOICES = ("auto", "zeiss_1", "zeiss_2", "vicivision", "dea")

ROW_FORMAT_BY_TYPE = {
    "zeiss_1": "Nome: ... | Measured value: ... | Nominal value: ... | Toll+: ... | Toll-: ... | Deviation: ... | +/-: ...",
    "zeiss_2": "Nome: ... | Attuale: ... | Nominale: ... | Toll. Superiore: ... | Toll. Inferiore: ... | Deviazione: ...",
    "vicivision": "ID: ... | Nome: ... | Nom: ... | Mis: ... | Oltre Tol: ... | Tol Inf: ... | Tol Sup: ...",
    "dea": "Quota: ... | Asse: ... | Nominale: ... | +Tol: ... | -Tol: ... | MIS: ... | DEV: ... | FUORITOL: ...",
}


@dataclass(frozen=True)
class DetectionProfile:
    status_x_start_ratio: float
    status_x_end_ratio: float
    y_start_ratio: float
    min_pixels_per_row: int
    min_run_height: int
    row_x_start_ratio: float = 0.0
    row_x_end_ratio: float = 1.0
    merge_gap: int = 12
    expand_top: int = 16
    expand_bottom: int = 16


DETECTION_PROFILE_BY_TYPE = {
    "auto": DetectionProfile(0.70, 1.00, 0.20, 14, 5),
    "zeiss_1": DetectionProfile(0.74, 1.00, 0.28, 18, 6),
    "zeiss_2": DetectionProfile(0.00, 0.18, 0.18, 6, 4, merge_gap=8, expand_top=8, expand_bottom=8),
    "vicivision": DetectionProfile(0.42, 0.56, 0.22, 12, 4, row_x_start_ratio=0.43, row_x_end_ratio=1.0, merge_gap=2, expand_top=8, expand_bottom=8),
    "dea": DetectionProfile(0.78, 1.00, 0.06, 10, 4, merge_gap=8, expand_top=52, expand_bottom=12),
}


def normalize_document_type(document_type: str | None) -> str:
    if not document_type:
        return "auto"

    value = document_type.strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "zeiss": "zeiss_1",
        "zeiss1": "zeiss_1",
        "zeiss_01": "zeiss_1",
        "zeiss2": "zeiss_2",
        "zeiss_02": "zeiss_2",
        "vici": "vicivision",
    }
    value = aliases.get(value, value)
    return value if value in DOCUMENT_TYPE_CHOICES else "auto"


def infer_document_type_from_filename(filename: str) -> str:
    lower = Path(filename).name.lower()
    if "zeiss_1" in lower or "zeiss1" in lower:
        return "zeiss_1"
    if "zeiss_2" in lower or "zeiss2" in lower:
        return "zeiss_2"
    if "vicivision" in lower or "vici" in lower:
        return "vicivision"
    if "dea" in lower:
        return "dea"
    return "auto"


def resolve_document_type(document_type: str | None, filename: str) -> str:
    normalized = normalize_document_type(document_type)
    if normalized != "auto":
        return normalized
    inferred = infer_document_type_from_filename(filename)
    return inferred if inferred != "auto" else "zeiss_1"


def get_row_format_for_document_type(document_type: str) -> str:
    normalized = normalize_document_type(document_type)
    if normalized == "auto":
        normalized = "zeiss_1"
    return ROW_FORMAT_BY_TYPE.get(normalized, ROW_FORMAT_BY_TYPE["zeiss_1"])


def get_detection_profile(document_type: str) -> DetectionProfile:
    normalized = normalize_document_type(document_type)
    return DETECTION_PROFILE_BY_TYPE.get(normalized, DETECTION_PROFILE_BY_TYPE["auto"])


def encode_file_base64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


def build_image_data_url(path: Path) -> str:
    encoded = encode_file_base64(path)
    suffix = path.suffix.lower()
    if suffix == ".png":
        mime_type = "image/png"
    elif suffix in {".jpg", ".jpeg"}:
        mime_type = "image/jpeg"
    elif suffix == ".webp":
        mime_type = "image/webp"
    else:
        mime_type = "application/octet-stream"
    return f"data:{mime_type};base64,{encoded}"


def detect_colored_status_rows(image_path: Path, *, profile: DetectionProfile) -> list[tuple[int, int]]:
    image = Image.open(image_path).convert("RGB")
    arr = np.asarray(image)
    height, width, _ = arr.shape

    x_start = max(0, min(width - 1, int(width * profile.status_x_start_ratio)))
    x_end = max(x_start + 1, min(width, int(width * profile.status_x_end_ratio)))
    y_start = max(0, min(height - 1, int(height * profile.y_start_ratio)))

    status_slice = arr[y_start:, x_start:x_end, :]
    r = status_slice[:, :, 0].astype(np.int16)
    g = status_slice[:, :, 1].astype(np.int16)
    b = status_slice[:, :, 2].astype(np.int16)

    warm_mask = (
        ((r > 170) & (g < 150) & (b < 150))
        | ((r > 180) & (g > 110) & (g < 220) & (b < 140))
        | ((r > 180) & (g > 130) & (b < 120))
    )

    row_scores = warm_mask.sum(axis=1)
    hot_rows = row_scores >= profile.min_pixels_per_row

    runs: list[tuple[int, int]] = []
    start: int | None = None
    for idx, is_hot in enumerate(hot_rows):
        if is_hot and start is None:
            start = idx
        elif not is_hot and start is not None:
            if idx - start >= profile.min_run_height:
                runs.append((start + y_start, idx - 1 + y_start))
            start = None

    if start is not None and len(hot_rows) - start >= profile.min_run_height:
        runs.append((start + y_start, len(hot_rows) - 1 + y_start))

    merged: list[tuple[int, int]] = []
    for run_start, run_end in runs:
        expanded = (max(0, run_start - profile.expand_top), min(height - 1, run_end + profile.expand_bottom))
        if not merged:
            merged.append(expanded)
            continue
        prev_start, prev_end = merged[-1]
        if expanded[0] <= prev_end + profile.merge_gap:
            merged[-1] = (prev_start, max(prev_end, expanded[1]))
        else:
            merged.append(expanded)

    return merged


def crop_detected_rows(page_image_path: Path, output_dir: Path, *, profile: DetectionProfile) -> list[tuple[Path, int]]:
    row_ranges = detect_colored_status_rows(page_image_path, profile=profile)
    if not row_ranges:
        return []

    image = Image.open(page_image_path).convert("RGB")
    width, height = image.size
    crop_left = max(0, min(width - 1, int(width * profile.row_x_start_ratio)))
    crop_right = max(crop_left + 1, min(width, int(width * profile.row_x_end_ratio)))
    row_paths: list[tuple[Path, int]] = []

    for idx, (top, bottom) in enumerate(row_ranges, start=1):
        crop_top = max(0, top)
        crop_bottom = min(height, bottom + 1)
        crop = image.crop((crop_left, crop_top, crop_right, crop_bottom))
        row_path = output_dir / f"{page_image_path.stem}_row_{idx:02d}.jpg"
        crop.save(row_path, format="JPEG", quality=90, optimize=True)
        row_paths.append((row_path, idx))

    return row_paths


def render_pdf_pages_to_images(
    pdf_path: Path,
    output_dir: Path,
    max_pages: int | None = None,
    scale: float = 2.0,
    max_image_size: int = 1600,
) -> list[tuple[Path, int]]:
    pdf = pdfium.PdfDocument(str(pdf_path))
    image_paths: list[tuple[Path, int]] = []

    try:
        total_pages = len(pdf)
        limit = total_pages if max_pages is None else min(max_pages, total_pages)
        for page_index in range(limit):
            page = pdf[page_index]
            bitmap = page.render(scale=scale)
            try:
                image = bitmap.to_pil().convert("RGB")
                image.thumbnail((max_image_size, max_image_size))
                image_path = output_dir / f"page_{page_index + 1:03d}.jpg"
                image.save(image_path, format="JPEG", quality=80, optimize=True)
                image_paths.append((image_path, page_index + 1))
            finally:
                bitmap.close()
                page.close()
    finally:
        pdf.close()

    return image_paths


class MeasureReportEngineService:
    def __init__(self, settings: Settings):
        self._settings = settings

    def prepare_pdf_bytes(
        self,
        *,
        pdf_bytes: bytes,
        file_name: str,
        document_type: str,
    ) -> dict[str, Any]:
        effective_type = resolve_document_type(document_type, file_name)
        row_format = get_row_format_for_document_type(effective_type)
        profile = get_detection_profile(effective_type)
        mode = (self._settings.measure_report_analysis_mode or "auto").strip().lower() or "auto"

        with tempfile.NamedTemporaryFile(prefix="measure_report_", suffix=".pdf", delete=False) as handle:
            handle.write(pdf_bytes)
            temp_pdf_path = Path(handle.name)

        try:
            with tempfile.TemporaryDirectory(prefix="measure_report_pages_") as temp_dir:
                temp_path = Path(temp_dir)
                effective_max_image_size = max(self._settings.measure_report_max_image_size, 2200) if effective_type == "vicivision" else self._settings.measure_report_max_image_size
                page_images = render_pdf_pages_to_images(
                    pdf_path=temp_pdf_path,
                    output_dir=temp_path,
                    max_pages=self._settings.measure_report_max_pages,
                    scale=self._settings.measure_report_render_scale,
                    max_image_size=effective_max_image_size,
                )
                if not page_images:
                    raise ValueError("Non sono riuscito a renderizzare il PDF in immagini.")

                candidates: list[dict[str, Any]] = []
                detected_row_count = 0
                uses_row_crops = mode != "pages_only"

                for page_image_path, page_index in page_images:
                    if uses_row_crops:
                        row_dir = temp_path / f"page_{page_index:03d}_rows"
                        row_dir.mkdir(exist_ok=True)
                        row_candidates = crop_detected_rows(page_image_path, row_dir, profile=profile)
                    else:
                        row_candidates = []

                    if row_candidates:
                        detected_row_count += len(row_candidates)
                        for row_path, row_index in row_candidates:
                            candidates.append(
                                {
                                    "candidate_id": f"page-{page_index:03d}-row-{row_index:02d}",
                                    "candidate_kind": "row",
                                    "page_index": page_index,
                                    "page_hint": f"Pagina {page_index}",
                                    "source_label": row_path.name,
                                    "image_data_url": build_image_data_url(row_path),
                                }
                            )
                        continue

                    candidates.append(
                        {
                            "candidate_id": f"page-{page_index:03d}",
                            "candidate_kind": "page",
                            "page_index": page_index,
                            "page_hint": f"Pagina {page_index}",
                            "source_label": page_image_path.name,
                            "image_data_url": build_image_data_url(page_image_path),
                        }
                    )

                return {
                    "document_type_used": effective_type,
                    "row_format": row_format,
                    "candidates": candidates,
                    "execution_metadata": {
                        "mode": mode,
                        "max_pages": self._settings.measure_report_max_pages,
                        "render_scale": self._settings.measure_report_render_scale,
                        "max_image_size": effective_max_image_size,
                        "file_name": file_name,
                        "page_count": len(page_images),
                        "candidate_count": len(candidates),
                        "detected_row_count": detected_row_count,
                        "fallback_page_count": sum(1 for item in candidates if item["candidate_kind"] == "page"),
                    },
                }
        finally:
            try:
                temp_pdf_path.unlink(missing_ok=True)
            except Exception:
                pass
