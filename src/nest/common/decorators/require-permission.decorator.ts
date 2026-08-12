import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSION_METADATA_KEY = "required_permission_key";

export const RequirePermission = (...permissionKeys: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION_METADATA_KEY, permissionKeys);
