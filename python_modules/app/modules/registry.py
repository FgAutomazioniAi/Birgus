from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.modules.base import PythonModule


@dataclass
class ModuleRegistry:
    _modules: dict[str, PythonModule]

    def warmup_all(self) -> None:
        for module in self._modules.values():
            module.warmup()

    def execute(self, module_name: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        module = self._modules.get(module_name)
        if module is None:
            raise ValueError(f"Modulo non trovato: {module_name}")
        return module.execute(action, payload)
