from __future__ import annotations

from dataclasses import dataclass

import boto3
from botocore.client import BaseClient

from app.config import Settings


@dataclass(frozen=True)
class GarageObjectPath:
    bucket: str
    key: str

    @staticmethod
    def parse(storage_path: str) -> "GarageObjectPath":
        trimmed = (storage_path or "").strip()
        if not trimmed.startswith("garage://"):
            raise ValueError(f"Storage path non supportato: {storage_path}")

        without_scheme = trimmed[len("garage://") :]
        slash_index = without_scheme.find("/")
        if slash_index <= 0 or slash_index == len(without_scheme) - 1:
            raise ValueError(f"Storage path non valido: {storage_path}")

        return GarageObjectPath(bucket=without_scheme[:slash_index], key=without_scheme[slash_index + 1 :])


class GarageStorageService:
    def __init__(self, settings: Settings):
        self._client: BaseClient = boto3.client(
            "s3",
            endpoint_url=settings.garage_s3_endpoint,
            region_name=settings.garage_s3_region,
            aws_access_key_id=settings.garage_s3_access_key_id,
            aws_secret_access_key=settings.garage_s3_secret_access_key,
            config=boto3.session.Config(s3={"addressing_style": "path" if settings.garage_s3_force_path_style else "virtual"}),
        )

    def get_object_bytes_from_storage_path(self, storage_path: str) -> bytes:
        target = GarageObjectPath.parse(storage_path)
        response = self._client.get_object(Bucket=target.bucket, Key=target.key)
        body = response.get("Body")
        if body is None:
            raise RuntimeError(f"Oggetto non disponibile su Garage: {storage_path}")

        payload = body.read()
        if not isinstance(payload, (bytes, bytearray)):
            raise RuntimeError(f"Payload Garage non valido per: {storage_path}")

        return bytes(payload)
