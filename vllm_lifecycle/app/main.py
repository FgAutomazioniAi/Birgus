import hmac
import os
import re
import subprocess
import tempfile
from pathlib import Path

import docker
from docker.errors import DockerException, NotFound
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field


MIN_MODEL_LEN = 1024
MAX_MODEL_LEN = 32768
ENV_KEY = "VLLM_MAX_MODEL_LEN"


class VllmRuntimeStatus(BaseModel):
    configured_max_model_len: int | None
    container_running: bool
    target_container: str


class UpdateMaxModelLenRequest(BaseModel):
    max_model_len: int = Field(ge=MIN_MODEL_LEN, le=MAX_MODEL_LEN)


app = FastAPI(title="Birgus vLLM Lifecycle")


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def authorize(token: str | None) -> None:
    if token is None or not hmac.compare_digest(token, required_env("VLLM_LIFECYCLE_TOKEN")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized vLLM lifecycle request")


def runtime_env_path() -> Path:
    path = Path(required_env("VLLM_RUNTIME_ENV_FILE"))
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="vLLM runtime configuration is unavailable")
    return path


def target_container():
    container_name = required_env("VLLM_TARGET_CONTAINER")
    try:
        return docker.from_env().containers.get(container_name)
    except NotFound:
        return None
    except DockerException as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Docker lifecycle service is unavailable") from error


def read_max_model_len(path: Path) -> int | None:
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"\s*VLLM_MAX_MODEL_LEN\s*=\s*(\d+)\s*", line)
        if match:
            return int(match.group(1))
    return None


def write_max_model_len(path: Path, value: int) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    replacement = f"{ENV_KEY}={value}"
    updated = False
    next_lines: list[str] = []
    for line in lines:
        if re.match(r"\s*VLLM_MAX_MODEL_LEN\s*=", line):
            next_lines.append(replacement)
            updated = True
        else:
            next_lines.append(line)
    if not updated:
        next_lines.append(replacement)

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp_file:
        temp_file.write("\n".join(next_lines) + "\n")
        temp_path = Path(temp_file.name)
    temp_path.replace(path)


def recreate_vllm() -> None:
    command = [
        "docker", "compose",
        "--project-name", required_env("VLLM_COMPOSE_PROJECT"),
        "-f", required_env("VLLM_COMPOSE_FILE"),
        "--profile", required_env("VLLM_COMPOSE_PROFILE"),
        "up", "-d", "--force-recreate", "vllm",
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.SubprocessError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to recreate the vLLM container") from error


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/v1/vllm/status", response_model=VllmRuntimeStatus)
def vllm_status(x_vllm_lifecycle_token: str | None = Header(default=None)) -> VllmRuntimeStatus:
    authorize(x_vllm_lifecycle_token)
    container = target_container()
    if container is not None:
        try:
            container.reload()
        except DockerException as error:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to read vLLM container status") from error
    return VllmRuntimeStatus(
        configured_max_model_len=read_max_model_len(runtime_env_path()),
        container_running=container is not None and container.status == "running",
        target_container=required_env("VLLM_TARGET_CONTAINER"),
    )


@app.post("/v1/vllm/max-model-len", response_model=VllmRuntimeStatus)
def update_max_model_len(
    payload: UpdateMaxModelLenRequest,
    x_vllm_lifecycle_token: str | None = Header(default=None),
) -> VllmRuntimeStatus:
    authorize(x_vllm_lifecycle_token)
    path = runtime_env_path()
    write_max_model_len(path, payload.max_model_len)
    recreate_vllm()
    return vllm_status(x_vllm_lifecycle_token)
