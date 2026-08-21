from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings


class MessagingSendError(Exception):
    pass


class MessagingService:
    def __init__(self, settings: Settings):
        self._settings = settings

    def send_telegram(self, *, chat_id: str, text: str) -> dict[str, Any]:
        if not self._settings.telegram_bot_token:
            raise MessagingSendError("TELEGRAM_BOT_TOKEN non configurato.")

        url = f"https://api.telegram.org/bot{self._settings.telegram_bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
        }

        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(url, json=payload)
        except httpx.RequestError as exc:
            raise MessagingSendError("Impossibile contattare Telegram.") from exc

        if response.status_code >= 400:
            raise MessagingSendError(f"Telegram ha risposto con errore {response.status_code}.")

        return {
            "status": "sent",
            "chat_id": chat_id,
            "provider": "telegram",
        }

    def send_whatsapp(self, *, to: str, text: str) -> dict[str, Any]:
        if not self._settings.whatsapp_access_token or not self._settings.whatsapp_phone_number_id:
            raise MessagingSendError("WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID non configurati.")

        url = f"https://graph.facebook.com/v21.0/{self._settings.whatsapp_phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self._settings.whatsapp_access_token}",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": text,
            },
        }

        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(url, headers=headers, json=payload)
        except httpx.RequestError as exc:
            raise MessagingSendError("Impossibile contattare WhatsApp.") from exc

        if response.status_code >= 400:
            raise MessagingSendError(f"WhatsApp ha risposto con errore {response.status_code}.")

        return {
            "status": "sent",
            "to": to,
            "provider": "whatsapp",
        }
