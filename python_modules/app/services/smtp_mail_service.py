from __future__ import annotations

import smtplib
from email.message import EmailMessage

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

        message = EmailMessage()
        message["From"] = self._settings.smtp_from
        message["To"] = to
        message["Subject"] = subject
        message.set_content(text)
        message.add_attachment(
            docx_bytes,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=file_name,
        )

        if self._settings.smtp_secure:
            with smtplib.SMTP_SSL(self._settings.smtp_host, self._settings.smtp_port, timeout=60) as client:
                client.login(self._settings.smtp_user, self._settings.smtp_pass)
                response = client.send_message(message)
                return None if not response else str(response)

        with smtplib.SMTP(self._settings.smtp_host, self._settings.smtp_port, timeout=60) as client:
            client.ehlo()
            if client.has_extn("STARTTLS"):
                client.starttls()
                client.ehlo()
            client.login(self._settings.smtp_user, self._settings.smtp_pass)
            response = client.send_message(message)
            return None if not response else str(response)
