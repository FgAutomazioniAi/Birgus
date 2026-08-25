from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ExecuteModuleRequest(BaseModel):
    module: str = Field(min_length=1)
    action: str = Field(min_length=1)
    input: dict[str, Any] = Field(default_factory=dict)


class ExecuteModuleResponse(BaseModel):
    ok: bool = True
    module: str
    action: str
    output: dict[str, Any]
