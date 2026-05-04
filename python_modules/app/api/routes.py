from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models import ExecuteModuleRequest, ExecuteModuleResponse
from app.modules.registry import ModuleRegistry

router = APIRouter(prefix="/v1", tags=["python_modules"])


def _registry(request: Request) -> ModuleRegistry:
    return request.app.state.module_registry


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/modules/execute", response_model=ExecuteModuleResponse)
def execute_module(payload: ExecuteModuleRequest, request: Request) -> ExecuteModuleResponse:
    registry = _registry(request)

    try:
        output = registry.execute(payload.module, payload.action, payload.input)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ExecuteModuleResponse(
        module=payload.module,
        action=payload.action,
        output=output,
    )
