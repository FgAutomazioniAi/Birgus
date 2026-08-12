import { SetMetadata } from "@nestjs/common";

export const REQUIRED_MODULE_METADATA_KEY = "required_module_key";

export const RequireModule = (...moduleKeys: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_MODULE_METADATA_KEY, moduleKeys);
