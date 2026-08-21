from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any

from app.services.openai_compatible_lm_service import OpenAiCompatibleLmService

N_SELF_CONSISTENCY = 5
MAX_VERIFY_RETRIES = 2
TEMPERATURE_DISCOVER = 0.3
STAGE_MAX_TOKENS = 2048


REASONING_MODULES = """
1 Come potrei ideare un esperimento per aiutare a risolvere questo problema?
2 Fai una lista di idee per risolvere questo problema, e applicale una alla volta.
3 Come potrei misurare i progressi su questo problema?
4 Come posso semplificare il problema per renderlo piu' facile da risolvere?
5 Quali sono le assunzioni chiave alla base di questo problema?
6 Quali sono i potenziali rischi e svantaggi di ciascuna soluzione?
7 Quali sono le prospettive o i punti di vista alternativi?
8 Quali sono le implicazioni a lungo termine?
9 Come posso scomporre questo problema in parti piu' piccole?
10 Usa pensiero critico, prove disponibili e ragionamento logico.
11 Usa pensiero creativo e soluzioni non convenzionali.
12 Cerca collaborazione e prospettive diverse.
13 Usa pensiero sistemico.
14 Usa analisi del rischio.
15 Usa pensiero riflessivo.
16 Qual e' il problema centrale?
17 Quali sono le cause sottostanti?
18 Quali strategie gia' provate sono rilevanti?
19 Quali ostacoli possono emergere?
20 Quali dati o informazioni servono?
21 Quali stakeholder sono coinvolti?
22 Quali risorse sono necessarie?
23 Come si misura il successo?
24 Quali indicatori usare?
25 Il problema richiede competenze tecniche specifiche?
26 Il problema ha vincoli fisici o operativi?
27 Il problema dipende dal comportamento umano?
28 Il problema richiede decisioni in incertezza?
29 Il problema richiede analisi dati o ottimizzazione?
30 Il problema e' una sfida di design?
31 Il problema richiede di affrontare un sistema piu' ampio?
32 Il problema e' urgente o dipendente dal tempo?
33 Che tipo di soluzioni si producono tipicamente?
34 Ipotizza altre possibili soluzioni.
35 Se la soluzione attuale fosse sbagliata, quali alternative ci sono?
36 Come modificare la migliore soluzione attuale?
37 Crea una soluzione completamente nuova.
38 Pensiamo passo dopo passo.
39 Facciamo un piano passo dopo passo e implementiamolo con chiarezza.
"""


class SelfDiscoverService:
    def __init__(self, lm_service: OpenAiCompatibleLmService):
        self._lm_service = lm_service

    def chat(
        self,
        *,
        instructions: str,
        input_text: str,
        ai_provider: dict[str, Any] | None,
        max_tokens: int,
        temperature: float,
    ) -> dict[str, Any]:
        instructions = instructions.strip()
        if instructions:
            task_description = instructions
            example = input_text
        else:
            task_description, example = self._infer_task_and_example(input_text, ai_provider)

        structure = self._discover_reasoning_structure(task_description, example, ai_provider)
        reply = self._solve_with_structure(
            structure=structure,
            instance=input_text,
            ai_provider=ai_provider,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return {"reply": reply, "reasoning_structure": structure}

    def _llm(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        ai_provider: dict[str, Any] | None,
        temperature: float,
        max_tokens: int = STAGE_MAX_TOKENS,
    ) -> str:
        result = self._lm_service.chat(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            ai_provider=ai_provider,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return str(result.get("content") or "").strip()

    def _infer_task_and_example(
        self,
        first_instance: str,
        ai_provider: dict[str, Any] | None,
    ) -> tuple[str, str]:
        inferred = self._llm(
            system_prompt="Sei un assistente che deduce il tipo generico di problema da un caso concreto.",
            user_prompt=f"""Analizza questo caso concreto e deduci:
1. Una descrizione GENERICA del tipo di problema.
2. Un esempio semplificato dello stesso tipo di problema.

Rispondi SOLO con JSON:
{{
  "task_description": "...",
  "example": "..."
}}

Caso:
{first_instance}""",
            ai_provider=ai_provider,
            temperature=0.2,
        )
        parsed = self._parse_json_safe(inferred)
        if parsed and "task_description" in parsed and "example" in parsed:
            return str(parsed["task_description"]), str(parsed["example"])
        return "Risolvere il tipo di problema descritto nel caso fornito", first_instance

    def _discover_reasoning_structure(
        self,
        task_description: str,
        example: str,
        ai_provider: dict[str, Any] | None,
    ) -> dict[str, str]:
        selected = self._llm(
            system_prompt="Sei un assistente esperto nel selezionare strategie di ragionamento.",
            user_prompt=f"""Dato il task, seleziona i 3-5 moduli piu' rilevanti.

Task: {task_description}
Esempio: {example}

Moduli disponibili:
{REASONING_MODULES}""",
            ai_provider=ai_provider,
            temperature=TEMPERATURE_DISCOVER,
        )

        adapted = self._llm(
            system_prompt="Sei un assistente esperto nell'adattare strategie generiche a un task specifico.",
            user_prompt=f"""Riformula questi moduli in modo concreto e azionabile.

Task: {task_description}
Moduli selezionati:
{selected}""",
            ai_provider=ai_provider,
            temperature=TEMPERATURE_DISCOVER,
        )

        implemented = self._llm(
            system_prompt="Trasforma un piano di ragionamento in JSON.",
            user_prompt=f"""Trasforma i moduli adattati in un piano step-by-step JSON.
Le chiavi devono essere descrittive, i valori stringa vuota.
Rispondi SOLO con JSON.

Task: {task_description}
Moduli adattati:
{adapted}""",
            ai_provider=ai_provider,
            temperature=TEMPERATURE_DISCOVER,
        )

        structure = self._parse_json_safe(implemented)
        if structure is None:
            return {
                "Comprendi il problema e i dati disponibili": "",
                "Scomponi in sotto-problemi": "",
                "Applica il ragionamento passo per passo": "",
                "Verifica la coerenza del risultato": "",
                "Formula la risposta finale": "",
            }
        return {str(key): "" if value is None else str(value) for key, value in structure.items()}

    def _solve_with_structure(
        self,
        *,
        structure: dict[str, str],
        instance: str,
        ai_provider: dict[str, Any] | None,
        temperature: float,
        max_tokens: int,
    ) -> str:
        final_attempts: list[str] = []
        full_attempts: list[str] = []

        for _ in range(N_SELF_CONSISTENCY):
            answer = self._solve_once(structure, instance, ai_provider, temperature, max_tokens)
            for _ in range(MAX_VERIFY_RETRIES):
                answer, ok = self._verify_and_correct(instance, answer, structure, ai_provider)
                if ok:
                    break
            full_attempts.append(answer)
            final_attempts.append(self._extract_final_answer(answer))

        most_common, _ = Counter(final_attempts).most_common(1)[0]
        for complete, final in zip(full_attempts, final_attempts):
            if final == most_common:
                return complete
        return full_attempts[0]

    def _solve_once(
        self,
        structure: dict[str, str],
        instance: str,
        ai_provider: dict[str, Any] | None,
        temperature: float,
        max_tokens: int,
    ) -> str:
        structure_json = json.dumps(structure, ensure_ascii=False, indent=2)
        return self._llm(
            system_prompt="Sei un assistente che risolve problemi seguendo rigorosamente un piano dato.",
            user_prompt=f"""Segui questo piano JSON e risolvi il caso.

Piano:
{structure_json}

Caso:
{instance}

Al termine scrivi la risposta finale su una riga preceduta da "RISPOSTA FINALE:".""",
            ai_provider=ai_provider,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    def _verify_and_correct(
        self,
        instance: str,
        answer: str,
        structure: dict[str, str],
        ai_provider: dict[str, Any] | None,
    ) -> tuple[str, bool]:
        verification = self._llm(
            system_prompt="Sei un revisore rigoroso che controlla una soluzione.",
            user_prompt=f"""Controlla questa soluzione rispetto al caso originale.
Se trovi errori scrivi "ERRORE TROVATO" e spiega. Se e' corretta scrivi "CORRETTO".

Caso originale:
{instance}

Soluzione:
{answer}""",
            ai_provider=ai_provider,
            temperature=0.1,
        )
        ok = "CORRETTO" in verification.upper() and "ERRORE" not in verification.upper()
        if ok:
            return answer, True

        structure_json = json.dumps(structure, ensure_ascii=False, indent=2)
        corrected = self._llm(
            system_prompt="Sei un assistente che corregge una soluzione precedente.",
            user_prompt=f"""La soluzione precedente aveva un problema:
{verification}

Correggi seguendo di nuovo il piano.

Piano:
{structure_json}

Caso originale:
{instance}

Scrivi la risposta finale corretta preceduta da "RISPOSTA FINALE:".""",
            ai_provider=ai_provider,
            temperature=0.2,
        )
        return corrected, False

    def _parse_json_safe(self, raw_text: str) -> dict[str, Any] | None:
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(cleaned)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    def _extract_final_answer(self, text: str) -> str:
        match = re.search(r"RISPOSTA FINALE:\s*(.+)", text, re.IGNORECASE)
        if match:
            return match.group(1).strip().lower()
        return text.strip().lower()[-200:]
