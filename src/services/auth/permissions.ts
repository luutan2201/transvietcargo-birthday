import type { UserRole } from '../../types/entities';

export type Permission =
  | 'customers.view' | 'customers.edit' | 'customers.delete'
  | 'templates.view' | 'templates.edit'
  | 'email.generate' | 'card.generate'
  | 'history.view' | 'history.delete'
  | 'settings.edit' | 'admin.access' | 'backup.manage';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'customers.view', 'customers.edit', 'customers.delete',
    'templates.view', 'templates.edit',
    'email.generate', 'card.generate',
    'history.view', 'history.delete',
    'settings.edit', 'admin.access', 'backup.manage',
  ],
  manager: [
    'customers.view', 'customers.edit',
    'templates.view', 'templates.edit',
    'email.generate', 'card.generate',
    'history.view',
  ],
  user: ['customers.view', 'templates.view', 'email.generate', 'card.generate', 'history.view'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
