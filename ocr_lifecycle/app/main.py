import hmac
import os

import docker
from docker.errors import DockerException, NotFound
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel


class OcrRuntimeStatus(BaseModel):
    running: bool


app = FastAPI(title="Birgus OCR Lifecycle")


def get_required_token() -> str:
    token = os.getenv("OCR_LIFECYCLE_TOKEN", "")
    if not token:
        raise RuntimeError("OCR_LIFECYCLE_TOKEN is required")
    return token


def authorize(token: str | None) -> None:
    if token is None or not hmac.compare_digest(token, get_required_token()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized OCR lifecycle request")


def get_target_container():
    container_name = os.getenv("OCR_TARGET_CONTAINER", "")
    if not container_name:
        raise RuntimeError("OCR_TARGET_CONTAINER is required")

    try:
        return docker.from_env().containers.get(container_name)
    except NotFound as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OCR container is unavailable") from error
    except DockerException as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Docker lifecycle service is unavailable") from error


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/v1/ocr/status", response_model=OcrRuntimeStatus)
def ocr_status(x_ocr_lifecycle_token: str | None = Header(default=None)) -> OcrRuntimeStatus:
    authorize(x_ocr_lifecycle_token)
    container = get_target_container()
    try:
        container.reload()
    except DockerException as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to read OCR container status") from error

    return OcrRuntimeStatus(running=container.status == "running")


@app.post("/v1/ocr/start", response_model=OcrRuntimeStatus)
def start_ocr(x_ocr_lifecycle_token: str | None = Header(default=None)) -> OcrRuntimeStatus:
    authorize(x_ocr_lifecycle_token)
    container = get_target_container()
    try:
        container.reload()
        if container.status != "running":
            container.start()
        container.reload()
    except DockerException as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to start OCR container") from error

    return OcrRuntimeStatus(running=container.status == "running")


@app.post("/v1/ocr/stop", response_model=OcrRuntimeStatus)
def stop_ocr(x_ocr_lifecycle_token: str | None = Header(default=None)) -> OcrRuntimeStatus:
    authorize(x_ocr_lifecycle_token)
    container = get_target_container()
    try:
        container.reload()
        if container.status == "running":
            container.stop(timeout=30)
        container.reload()
    except DockerException as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to stop OCR container") from error

    return OcrRuntimeStatus(running=container.status == "running")
