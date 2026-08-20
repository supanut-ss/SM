import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import type { PermissionAction, PermissionResource } from "@lotus-desk/contracts";

export type AppAbility = MongoAbility<[PermissionAction, PermissionResource]>;

/**
 * แปลง permission key แบบ "resource:action" (ดู packages/contracts/src/permissions.ts)
 * เป็น CASL ability — "manage" ครอบคลุม "view" ในตัว (จัดการได้ย่อมดูได้)
 */
export function buildAbility(permissionKeys: readonly string[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const key of permissionKeys) {
    const [resource, action] = key.split(":") as [PermissionResource, PermissionAction];
    can(action, resource);
    if (action === "manage") {
      can("view", resource);
    }
  }

  return build();
}
