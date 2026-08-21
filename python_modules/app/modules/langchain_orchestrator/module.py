from __future__ import annotations

from typing import Any

from langchain_core.runnables import RunnableLambda

from app.modules.base import PythonModule
from app.services.openai_compatible_lm_service import OpenAiCompatibleLmService
from app.services.self_discover_service import SelfDiscoverService


class LangchainOrchestratorModule(PythonModule):
    def __init__(self, lm_service: OpenAiCompatibleLmService):
        self._lm_service = lm_service
        self._self_discover_service = SelfDiscoverService(lm_service)
        self._runnables = {
            "chat": RunnableLambda(self._chat),
            "structure_text": RunnableLambda(self._structure_text),
            "compose_email": RunnableLambda(self._compose_email),
        }

    @property
    def name(self) -> str:
        return "langchain_orchestrator"

    def warmup(self) -> None:
        return None

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        if action == "pipeline_execute":
            return self._pipeline_execute(payload)

        runnable = self._runnables.get(action)
        if runnable is None:
            raise ValueError(f"Action non supportata per langchain_orchestrator: {action}")
        return runnable.invoke(payload)

    def _pipeline_execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        steps = payload.get("steps")
        if not isinstance(steps, list) or len(steps) == 0:
            raise ValueError("Campo obbligatorio mancante o non valido: input.steps")

        continue_on_error = bool(payload.get("continue_on_error", False))
        previous_output: dict[str, Any] = {}
        results: list[dict[str, Any]] = []

        for index, raw_step in enumerate(steps):
            if not isinstance(raw_step, dict):
                raise ValueError(f"Step pipeline non valido all'indice {index}")

            action = str(raw_step.get("action") or raw_step.get("type") or "").strip()
            label = str(raw_step.get("label") or action or f"step_{index + 1}")
            merge_previous = bool(raw_step.get("merge_previous", True))
            step_input = raw_step.get("input") if isinstance(raw_step.get("input"), dict) else {}
            effective_input = {**previous_output, **step_input} if merge_previous else step_input

            try:
                output = self.execute(action, effective_input)
                previous_output = output if isinstance(output, dict) else {"result": output}
                results.append({
                    "index": index,
                    "action": action,
                    "label": label,
                    "ok": True,
                    "output": output,
                })
            except Exception as exc:  # noqa: BLE001 - pipeline must report step failures.
                results.append({
                    "index": index,
                    "action": action,
                    "label": label,
                    "ok": False,
                    "error": str(exc),
                })
                if not continue_on_error:
                    return {"completed": False, "results": results}

        return {"completed": True, "results": results}

    def _chat(self, payload: dict[str, Any]) -> dict[str, Any]:
        input_text = str(payload.get("input_text") or payload.get("text") or "").strip()
        if not input_text:
            raise ValueError("Campo obbligatorio mancante: input.input_text")

        max_tokens = self._optional_int(payload.get("max_tokens"))
        temperature = self._optional_float(payload.get("temperature"))
        if bool(payload.get("use_deep_reasoning") or payload.get("useDeepReasoning")):
            return self._self_discover_service.chat(
                instructions=str(payload.get("instructions") or "").strip(),
                input_text=input_text,
                ai_provider=self._ai_provider(payload),
                max_tokens=max_tokens or 2048,
                temperature=temperature if temperature is not None else 0.7,
            )

        result = self._lm_service.chat(
            system_prompt=str(payload.get("instructions") or "Sei un assistente utile.").strip(),
            user_prompt=input_text,
            ai_provider=self._ai_provider(payload),
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return {"reply": result["content"], "model": result["model"], "raw_response": result["response"]}

    def _structure_text(self, payload: dict[str, Any]) -> dict[str, Any]:
        extracted_text = str(payload.get("extracted_text") or payload.get("input_text") or "").strip()
        instructions = str(payload.get("instructions") or "").strip()
        if not extracted_text:
            raise ValueError("Campo obbligatorio mancante: input.extracted_text")
        if not instructions:
            raise ValueError("Campo obbligatorio mancante: input.instructions")

        schema = payload.get("json_schema")
        schema_hint = f"\nSchema atteso: {schema}" if isinstance(schema, dict) else ""
        result = self._lm_service.chat(
            system_prompt=(
                "Sei un assistente che estrae dati strutturati da testo OCR. "
                "Rispondi SOLO con un oggetto JSON valido, senza markdown e senza testo extra."
            ),
            user_prompt=f"Istruzioni: {instructions}{schema_hint}\n\nTesto:\n{extracted_text}",
            ai_provider=self._ai_provider(payload),
            max_tokens=self._optional_int(payload.get("max_tokens")),
            temperature=self._optional_float(payload.get("temperature")) or 0,
        )
        structured_data = self._lm_service.extract_json(str(result["content"]))
        return {
            "structured_data": structured_data,
            "raw_output": result["content"],
            "model": result["model"],
            "raw_response": result["response"],
        }

    def _compose_email(self, payload: dict[str, Any]) -> dict[str, Any]:
        parts: list[str] = []
        for label, key in [
            ("Cliente", "client_name"),
            ("Progetto", "project_name"),
            ("Tono richiesto", "tone"),
            ("Contesto", "context"),
            ("Istruzioni aggiuntive", "extra_instructions"),
        ]:
            value = str(payload.get(key) or "").strip()
            if value:
                parts.append(f"{label}: {value}")

        if not parts:
            raise ValueError("Campo obbligatorio mancante: input.context")

        result = self._lm_service.chat(
            system_prompt=(
                "Sei un assistente che scrive email professionali in italiano per Birgus. "
                "Rispondi SOLO con un oggetto JSON valido con le chiavi subject e text."
            ),
            user_prompt="\n\n".join(parts),
            ai_provider=self._ai_provider(payload),
            max_tokens=self._optional_int(payload.get("max_tokens")),
            temperature=self._optional_float(payload.get("temperature")) or 0.3,
        )
        parsed = self._lm_service.extract_json(str(result["content"]))
        subject = str(parsed.get("subject") or "").strip()
        text = str(parsed.get("text") or "").strip()
        if not subject or not text:
            raise ValueError("Il modello non ha restituito subject/text validi.")
        return {
            "subject": subject,
            "text": text,
            "raw_output": result["content"],
            "model": result["model"],
            "raw_response": result["response"],
        }

    def _optional_int(self, value: Any) -> int | None:
        if value is None or str(value).strip() == "":
            return None
        parsed = int(value)
        return parsed if parsed > 0 else None

    def _optional_float(self, value: Any) -> float | None:
        if value is None or str(value).strip() == "":
            return None
        return float(value)

    def _ai_provider(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        provider = payload.get("ai_provider")
        return provider if isinstance(provider, dict) else None
