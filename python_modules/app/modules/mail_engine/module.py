from __future__ import annotations

import base64
from typing import Any

from app.modules.base import PythonModule
from app.services.smtp_mail_service import SmtpMailService


class MailEngineModule(PythonModule):
    def __init__(self, smtp_mail_service: SmtpMailService):
        self._smtp_mail_service = smtp_mail_service

    @property
    def name(self) -> str:
        return "mail_engine"

    def warmup(self) -> None:
        return

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action == "send_quotation_email":
            return self._send_quotation_email(payload)
        if action == "send_email":
            return self._send_email(payload)

        raise ValueError(f"Action non supportata per mail_engine: {action}")

    def _send_quotation_email(self, payload: dict[str, Any]) -> dict[str, Any]:
        to = str(payload.get("to", "")).strip()
        version_label = str(payload.get("version_label", "")).strip()
        file_name = str(payload.get("file_name", "preventivo.docx")).strip() or "preventivo.docx"
        encoded_docx = str(payload.get("docx_base64", "")).strip()

        if not to:
            raise ValueError("Campo obbligatorio mancante: input.to")
        if not version_label:
            raise ValueError("Campo obbligatorio mancante: input.version_label")
        if not encoded_docx:
            raise ValueError("Campo obbligatorio mancante: input.docx_base64")

        try:
            docx_bytes = base64.b64decode(encoded_docx)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("Campo non valido: input.docx_base64") from exc

        client_name = self._to_optional_string(payload.get("client_name"))
        project_name = self._to_optional_string(payload.get("project_name"))
        print(
            "[python_modules][mail_engine][start] "
            f"action=send_quotation_email to={to} version_label={version_label} file_name={file_name}"
        )
        transport_result = self._smtp_mail_service.send_quotation_email(
            to=to,
            client_name=client_name,
            project_name=project_name,
            version_label=version_label,
            file_name=file_name,
            docx_bytes=docx_bytes,
            mail_provider=self._mail_provider(payload),
        )
        print(
            "[python_modules][mail_engine][done] "
            f"to={to} version_label={version_label} file_name={file_name} size_bytes={len(docx_bytes)}"
        )

        return {
            "to": to,
            "version_label": version_label,
            "file_name": file_name,
            "size_bytes": len(docx_bytes),
            "transport_result": transport_result,
        }

    def _to_optional_string(self, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        normalized = value.strip()
        return normalized or None

    def _send_email(self, payload: dict[str, Any]) -> dict[str, Any]:
        to = str(payload.get("to", "")).strip()
        subject = str(payload.get("subject", "")).strip()
        text = str(payload.get("text", "")).strip()
        if not to:
            raise ValueError("Campo obbligatorio mancante: input.to")
        if not subject:
            raise ValueError("Campo obbligatorio mancante: input.subject")
        if not text:
            raise ValueError("Campo obbligatorio mancante: input.text")

        attachments = self._decode_attachments(payload.get("attachments"))
        transport_result = self._smtp_mail_service.send_email(
            to=to,
            subject=subject,
            text=text,
            attachments=attachments,
            mail_provider=self._mail_provider(payload),
        )

        return {
            "status": "sent",
            "to": to,
            "subject": subject,
            "attachments_sent": [str(attachment.get("file_name")) for attachment in attachments],
            "transport_result": transport_result,
        }

    def _decode_attachments(self, value: Any) -> list[dict[str, Any]]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("Campo non valido: input.attachments")

        attachments: list[dict[str, Any]] = []
        for item in value:
            if not isinstance(item, dict):
                raise ValueError("Campo non valido: input.attachments[]")
            file_name = str(item.get("file_name") or item.get("filename") or "attachment.bin").strip() or "attachment.bin"
            encoded = str(item.get("content_base64") or item.get("base64") or "").strip()
            if not encoded:
                raise ValueError(f"Base64 mancante per allegato '{file_name}'")
            try:
                content = base64.b64decode(encoded)
            except Exception as exc:  # noqa: BLE001
                raise ValueError(f"Base64 non valido per allegato '{file_name}'") from exc
            attachments.append({"file_name": file_name, "content": content})
        return attachments

    def _mail_provider(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        provider = payload.get("mail_provider")
        return provider if isinstance(provider, dict) else None
