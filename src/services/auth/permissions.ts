import type { UserRole } from '../../types/entities';

export type Permission =
  | 'customers.view' | 'customers.edit' | 'customers.delete'
  | 'templates.view' | 'templates.edit'
  | 'email.generate' | 'card.generate'
  | 'history.view' | 'history.delete'
  | 'settings.edit' | 'admin.access' | 'backup.manage';

/**
 * admin  — full access to everything, including managing other accounts
 *          (create, reset password, delete, change role).
 * manager — can view AND edit day-to-day data (customers, templates,
 *          generate emails/cards) but cannot access Admin at all —
 *          no creating, editing, or deleting other accounts.
 * user   — read-only: can view Customers/Templates/History, cannot
 *          create, edit, delete, or generate anything.
 */
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
  user: ['customers.view', 'templates.view', 'history.view'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
