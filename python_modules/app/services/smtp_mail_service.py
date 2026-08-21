from __future__ import annotations

import mimetypes
import json
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage
from typing import Any

from app.config import Settings


class SmtpMailService:
    def __init__(self, settings: Settings):
        self._settings = settings

    def send_quotation_email(
        self,
        *,
        to: str,
        client_name: str | None,
        project_name: str | None,
        version_label: str,
        file_name: str,
        docx_bytes: bytes,
        mail_provider: dict[str, Any] | None = None,
    ) -> str | None:
        safe_project_name = (project_name or "").strip() or "il progetto richiesto"
        greeting_name = (client_name or "").strip() or "cliente"
        subject = f"Preventivo {safe_project_name} {version_label}".strip()
        text = "\n".join(
            [
                f"Ciao {greeting_name},",
                "",
                f"in allegato trovi il preventivo DOCX relativo a {safe_project_name}, versione {version_label}.",
                "",
                "Il documento e' stato generato automaticamente da Birgus.",
                "",
                "Cordiali saluti,",
                "Birgus",
            ]
        )

        return self.send_email(
            to=to,
            subject=subject,
            text=text,
            attachments=[{
                "file_name": file_name,
                "content": docx_bytes,
                "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }],
            mail_provider=mail_provider,
        )

    def send_email(
        self,
        *,
        to: str,
        subject: str,
        text: str,
        attachments: list[dict[str, Any]] | None = None,
        mail_provider: dict[str, Any] | None = None,
    ) -> str | None:
        config = self._resolve_provider(mail_provider)
        if config["provider"] == "resend":
            return self._send_email_resend(
                config=config,
                to=to,
                subject=subject,
                text=text,
                attachments=attachments or [],
            )
        return self._send_email_smtp(
            config=config,
            to=to,
            subject=subject,
            text=text,
            attachments=attachments or [],
        )

    def _send_email_smtp(
        self,
        *,
        config: dict[str, Any],
        to: str,
        subject: str,
        text: str,
        attachments: list[dict[str, Any]],
    ) -> str | None:
        message = EmailMessage()
        message["From"] = str(config.get("from") or "")
        message["To"] = to
        message["Subject"] = subject
        message.set_content(text)

        for attachment in attachments:
            filename = str(attachment.get("file_name") or attachment.get("filename") or "attachment.bin")
            content = attachment.get("content")
            if not isinstance(content, bytes):
                raise ValueError(f"Allegato '{filename}' non valido.")
            maintype, subtype = self._guess_mime(filename)
            message.add_attachment(content, maintype=maintype, subtype=subtype, filename=filename)

        host = str(config.get("smtp_host") or "")
        port = int(config.get("smtp_port") or 587)
        user = str(config.get("smtp_user") or "")
        password = str(config.get("smtp_pass") or "")
        if not host:
            raise ValueError("Configurazione email mancante: smtp_host")

        if bool(config.get("smtp_secure")):
            with smtplib.SMTP_SSL(host, port, timeout=60) as client:
                if user and password:
                    client.login(user, password)
                response = client.send_message(message)
                return None if not response else str(response)

        with smtplib.SMTP(host, port, timeout=60) as client:
            client.ehlo()
            if client.has_extn("STARTTLS"):
                client.starttls()
                client.ehlo()
            if user and password:
                client.login(user, password)
            response = client.send_message(message)
            return None if not response else str(response)

    def _send_email_resend(
        self,
        *,
        config: dict[str, Any],
        to: str,
        subject: str,
        text: str,
        attachments: list[dict[str, Any]],
    ) -> str | None:
        api_key = str(config.get("resend_api_key") or "")
        sender = str(config.get("from") or "")
        if not api_key:
            raise ValueError("Configurazione email mancante: resend_api_key")
        if not sender:
            raise ValueError("Configurazione email mancante: from")

        payload: dict[str, Any] = {
            "from": sender,
            "to": [to],
            "subject": subject,
            "text": text,
        }
        if attachments:
            payload["attachments"] = [
                {
                    "filename": str(item.get("file_name") or item.get("filename") or "attachment.bin"),
                    "content": self._attachment_base64(item),
                }
                for item in attachments
            ]

        request = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                response_body = response.read().decode("utf-8")
                return response_body or None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise ValueError(f"Resend HTTP {exc.code}: {detail}") from exc

    def _resolve_provider(self, override: dict[str, Any] | None) -> dict[str, Any]:
        raw = override if isinstance(override, dict) else {}
        provider = str(raw.get("provider") or self._settings.mail_provider or "smtp").strip().lower()
        if provider not in {"smtp", "resend"}:
            raise ValueError(f"Provider email non supportato: {provider}")
        return {
            "provider": provider,
            "from": str(raw.get("from") or self._settings.mail_from or self._settings.smtp_from or "").strip(),
            "smtp_host": str(raw.get("smtp_host") or self._settings.smtp_host or "").strip(),
            "smtp_port": int(raw.get("smtp_port") or self._settings.smtp_port or 587),
            "smtp_secure": bool(raw.get("smtp_secure", self._settings.smtp_secure)),
            "smtp_user": str(raw.get("smtp_user") or self._settings.smtp_user or "").strip(),
            "smtp_pass": str(raw.get("smtp_pass") or self._settings.smtp_pass or "").strip(),
            "resend_api_key": str(raw.get("resend_api_key") or self._settings.resend_api_key or "").strip(),
        }

    def _attachment_base64(self, attachment: dict[str, Any]) -> str:
        content = attachment.get("content")
        if not isinstance(content, bytes):
            raise ValueError("Allegato non valido.")
        import base64
        return base64.b64encode(content).decode("ascii")

    def _guess_mime(self, filename: str) -> tuple[str, str]:
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            return "application", "octet-stream"
        maintype, subtype = mime_type.split("/", 1)
        return maintype, subtype
