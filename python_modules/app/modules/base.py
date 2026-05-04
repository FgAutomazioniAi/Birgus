from __future__ import annotations

from typing import Any, Protocol


class PythonModule(Protocol):
    @property
    def name(self) -> str:
        ...

    def warmup(self) -> None:
        ...

    def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        ...
