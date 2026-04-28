import { GarageObjectStorage } from "./GarageObjectStorage.js";
import { InMemoryObjectStorage } from "./InMemoryObjectStorage.js";
import { ProjectBinaryStorage } from "./ProjectBinaryStorage.js";

export class StorageSelector {
  public static create(): ProjectBinaryStorage {
    if (
      process.env.GARAGE_S3_ENDPOINT
      && process.env.GARAGE_S3_BUCKET
      && process.env.GARAGE_S3_ACCESS_KEY_ID
      && process.env.GARAGE_S3_SECRET_ACCESS_KEY
    ) {
      return new GarageObjectStorage();
    }

    return new InMemoryObjectStorage();
  }
}
