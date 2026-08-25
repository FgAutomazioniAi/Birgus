from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    garage_s3_endpoint: str
    garage_s3_region: str
    garage_s3_access_key_id: str
    garage_s3_secret_access_key: str
    garage_s3_force_path_style: bool
    paddle_ocr_home: str
    ocr_engine_lang: str

    @staticmethod
    def from_env() -> "Settings":
        return Settings(
            garage_s3_endpoint=os.getenv("GARAGE_S3_ENDPOINT", "http://garage:3900"),
            garage_s3_region=os.getenv("GARAGE_S3_REGION", "garage"),
            garage_s3_access_key_id=os.getenv("GARAGE_S3_ACCESS_KEY_ID", ""),
            garage_s3_secret_access_key=os.getenv("GARAGE_S3_SECRET_ACCESS_KEY", ""),
            garage_s3_force_path_style=os.getenv("GARAGE_S3_FORCE_PATH_STYLE", "true").lower() in {"1", "true", "yes", "on"},
            paddle_ocr_home=os.getenv("PADDLEOCR_HOME", "/app/storage/paddleocr_cache"),
            ocr_engine_lang=os.getenv("OCR_ENGINE_LANG", "it"),
        )
