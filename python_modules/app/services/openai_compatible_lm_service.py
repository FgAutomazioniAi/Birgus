from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import Settings


class LmServiceError(Exception):
    """Raised when the configured OpenAI-compatible provider fails."""


class OpenAiCompatibleLmService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._base_url = settings.ai_provider_base_url.rstrip("/")
        self._completions_path = self._normalize_path(settings.ai_provider_completions_path)

    def chat(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        ai_provider: dict[str, Any] | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        provider = ai_provider if isinstance(ai_provider, dict) else {}
        model = str(provider.get("chat_model") or provider.get("chatModel") or self._settings.ai_provider_chat_model).strip()
        base_url = str(provider.get("base_url") or provider.get("baseUrl") or self._base_url).strip().rstrip("/")
        completions_path = self._normalize_path(
            str(provider.get("completions_path") or provider.get("completionsPath") or self._completions_path).strip()
        )
        api_key = str(provider.get("api_key") or provider.get("apiKey") or self._settings.ai_provider_api_key).strip()
        timeout_ms = self._optional_int(provider.get("timeout_ms") or provider.get("timeoutMs")) or self._settings.ai_provider_timeout_ms
        provider_temperature = self._optional_float(provider.get("temperature"))

        payload: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": provider_temperature if temperature is None and provider_temperature is not None else (
                self._settings.ai_provider_temperature if temperature is None else temperature
            ),
            "stream": False,
        }
        token_budget = max_tokens or self._optional_int(provider.get("max_output_tokens") or provider.get("maxOutputTokens")) or self._settings.ai_provider_max_output_tokens
        if token_budget > 0:
            payload["max_tokens"] = int(token_budget)
        self._apply_generation_options(payload, provider)
        if response_format:
            payload["response_format"] = response_format

        try:
            with httpx.Client(timeout=timeout_ms / 1000) as client:
                response = client.post(self._endpoint(base_url, completions_path), json=payload, headers=self._headers(api_key))
        except httpx.RequestError as exc:
            raise LmServiceError(f"AI provider non raggiungibile: {exc}") from exc

        if response.status_code >= 400:
            raise LmServiceError(f"AI provider HTTP {response.status_code}: {response.text}")

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LmServiceError(f"Risposta AI provider in formato inatteso: {data}") from exc

        return {
            "model": data.get("model", model),
            "content": str(content or "").strip(),
            "response": data,
        }

    def extract_json(self, raw_output: str) -> dict[str, Any]:
        text = raw_output.strip()
        if text.startswith("```"):
            text = text.strip("`").strip()
            if text.lower().startswith("json"):
                text = text[4:].strip()

        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise LmServiceError("Nessun oggetto JSON trovato nell'output del modello.")

        try:
            parsed = json.loads(text[start:end + 1])
        except json.JSONDecodeError as exc:
            raise LmServiceError(f"JSON non valido nell'output del modello: {exc}") from exc

        if not isinstance(parsed, dict):
            raise LmServiceError("L'output JSON del modello non e' un oggetto.")
        return parsed

    def _endpoint(self, base_url: str, completions_path: str) -> str:
        if base_url.endswith("/v1") and completions_path.startswith("/v1/"):
            return f"{base_url}{completions_path[3:]}"
        return f"{base_url}{completions_path}"

    def _headers(self, api_key: str) -> dict[str, str]:
        headers = {"content-type": "application/json"}
        if api_key:
            headers["authorization"] = f"Bearer {api_key}"
        return headers

    def _normalize_path(self, value: str) -> str:
        return value if value.startswith("/") else f"/{value}"

    def _optional_int(self, value: Any) -> int | None:
        if value is None or str(value).strip() == "":
            return None
        parsed = int(value)
        return parsed if parsed > 0 else None

    def _optional_float(self, value: Any) -> float | None:
        if value is None or str(value).strip() == "":
            return None
        return float(value)

    def _optional_non_negative_int(self, value: Any) -> int | None:
        if value is None or str(value).strip() == "":
            return None
        parsed = int(value)
        return parsed if parsed >= 0 else None

    def _apply_generation_options(self, payload: dict[str, Any], provider: dict[str, Any]) -> None:
        payload["top_p"] = self._optional_float(provider.get("top_p") or provider.get("topP"))
        if payload["top_p"] is None:
            payload["top_p"] = self._settings.ai_provider_top_p

        top_k = self._optional_int(provider.get("top_k") or provider.get("topK"))
        payload["top_k"] = self._settings.ai_provider_top_k if top_k is None else top_k

        payload["min_p"] = self._optional_float(provider.get("min_p") or provider.get("minP"))
        if payload["min_p"] is None:
            payload["min_p"] = self._settings.ai_provider_min_p

        payload["repetition_penalty"] = self._optional_float(provider.get("repetition_penalty") or provider.get("repetitionPenalty"))
        if payload["repetition_penalty"] is None:
            payload["repetition_penalty"] = self._settings.ai_provider_repetition_penalty

        seed = self._optional_non_negative_int(provider.get("seed"))
        if seed is None:
            seed = self._settings.ai_provider_seed
        if seed is not None:
            payload["seed"] = seed

        context_limit = self._optional_int(provider.get("context_token_limit") or provider.get("contextTokenLimit"))
        if context_limit is None:
            context_limit = self._settings.ai_provider_context_token_limit
        if context_limit is not None:
            payload["truncate_prompt_tokens"] = context_limit
