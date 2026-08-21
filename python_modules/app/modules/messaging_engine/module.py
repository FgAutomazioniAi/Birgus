from __future__ import annotations

from typing import Any

from app.modules.base import PythonModule
from app.services.messaging_service import MessagingService


class MessagingEngineModule(PythonModule):
    def __init__(self, messaging_service: MessagingService):
        self._messaging_service = messaging_service

    @property
    def name(self) -> str:
        return "messaging_engine"

    def warmup(self) -> None:
        return

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action == "send_telegram":
            return self._send_telegram(payload)
        if action == "send_whatsapp":
            return self._send_whatsapp(payload)

        raise ValueError(f"Action non supportata per messaging_engine: {action}")

    def _send_telegram(self, payload: dict[str, Any]) -> dict[str, Any]:
        chat_id = str(payload.get("chat_id", "")).strip()
        text = str(payload.get("text", "")).strip()
        if not chat_id:
            raise ValueError("Campo obbligatorio mancante: input.chat_id")
        if not text:
            raise ValueError("Campo obbligatorio mancante: input.text")

        return self._messaging_service.send_telegram(chat_id=chat_id, text=text)

    def _send_whatsapp(self, payload: dict[str, Any]) -> dict[str, Any]:
        to = str(payload.get("to", "")).strip()
        text = str(payload.get("text", "")).strip()
        if not to:
            raise ValueError("Campo obbligatorio mancante: input.to")
        if not text:
            raise ValueError("Campo obbligatorio mancante: input.text")

        return self._messaging_service.send_whatsapp(to=to, text=text)
