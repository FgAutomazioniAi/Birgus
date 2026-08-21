from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Settings:
    garage_s3_endpoint: str
    garage_s3_region: str
    garage_s3_access_key_id: str
    garage_s3_secret_access_key: str
    garage_s3_force_path_style: bool
    paddle_ocr_home: str
    ocr_engine_lang: str
    smtp_host: str
    smtp_port: int
    smtp_secure: bool
    smtp_user: str
    smtp_pass: str
    smtp_from: str
    mail_provider: str
    mail_from: str
    resend_api_key: str
    measure_report_analysis_mode: str
    measure_report_max_pages: Optional[int]
    measure_report_render_scale: float
    measure_report_max_image_size: int
    ai_provider_base_url: str
    ai_provider_api_key: str
    ai_provider_chat_model: str
    ai_provider_completions_path: str
    ai_provider_timeout_ms: int
    ai_provider_temperature: float
    ai_provider_max_output_tokens: int
    telegram_bot_token: str
    whatsapp_access_token: str
    whatsapp_phone_number_id: str

    @staticmethod
    def from_env() -> "Settings":
        max_pages_raw = os.getenv("MEASURE_REPORT_MAX_PAGES", "").strip()
        return Settings(
            garage_s3_endpoint=os.getenv("GARAGE_S3_ENDPOINT", "http://garage:3900"),
            garage_s3_region=os.getenv("GARAGE_S3_REGION", "garage"),
            garage_s3_access_key_id=os.getenv("GARAGE_S3_ACCESS_KEY_ID", ""),
            garage_s3_secret_access_key=os.getenv("GARAGE_S3_SECRET_ACCESS_KEY", ""),
            garage_s3_force_path_style=os.getenv("GARAGE_S3_FORCE_PATH_STYLE", "true").lower() in {"1", "true", "yes", "on"},
            paddle_ocr_home=os.getenv("PADDLEOCR_HOME", "/app/storage/paddleocr_cache"),
            ocr_engine_lang=os.getenv("OCR_ENGINE_LANG", "it"),
            smtp_host=os.getenv("SMTP_HOST", ""),
            smtp_port=int(os.getenv("SMTP_PORT", "587")),
            smtp_secure=os.getenv("SMTP_SECURE", "false").lower() in {"1", "true", "yes", "on"},
            smtp_user=os.getenv("SMTP_USER", ""),
            smtp_pass=os.getenv("SMTP_PASS", ""),
            smtp_from=os.getenv("SMTP_FROM", ""),
            mail_provider=os.getenv("MAIL_PROVIDER", "smtp"),
            mail_from=os.getenv("MAIL_FROM", os.getenv("SMTP_FROM", "")),
            resend_api_key=os.getenv("RESEND_API_KEY", ""),
            measure_report_analysis_mode=os.getenv("MEASURE_REPORT_ANALYSIS_MODE", "auto"),
            measure_report_max_pages=int(max_pages_raw) if max_pages_raw else None,
            measure_report_render_scale=float(os.getenv("MEASURE_REPORT_RENDER_SCALE", "2.0")),
            measure_report_max_image_size=int(os.getenv("MEASURE_REPORT_MAX_IMAGE_SIZE", "1800")),
            ai_provider_base_url=os.getenv("AI_PROVIDER_BASE_URL", os.getenv("ORCH_LM_BASE_URL", "http://vllm:8000/v1")),
            ai_provider_api_key=os.getenv("AI_PROVIDER_API_KEY", os.getenv("VLLM_API_KEY", "")),
            ai_provider_chat_model=os.getenv("AI_PROVIDER_CHAT_MODEL", os.getenv("ORCH_LM_MODEL", "birgus-vl")),
            ai_provider_completions_path=os.getenv("AI_PROVIDER_COMPLETIONS_PATH", os.getenv("ORCH_LM_COMPLETIONS_PATH", "/v1/chat/completions")),
            ai_provider_timeout_ms=int(os.getenv("AI_PROVIDER_TIMEOUT_MS", os.getenv("ORCH_LM_TIMEOUT_MS", "600000"))),
            ai_provider_temperature=float(os.getenv("AI_PROVIDER_TEMPERATURE", os.getenv("ORCH_LM_TEMPERATURE", "0"))),
            ai_provider_max_output_tokens=int(os.getenv("AI_PROVIDER_MAX_OUTPUT_TOKENS", os.getenv("ORCH_LM_MAX_OUTPUT_TOKENS", "800"))),
            telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
            whatsapp_access_token=os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
            whatsapp_phone_number_id=os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
        )
