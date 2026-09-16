export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  INVENTORY_ADMIN: 'inventory_admin',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  WAREHOUSE_STAFF: 'warehouse_staff',
}

/** List of roles that can be selected in the user modal */
export const ROLE_OPTIONS_LIST = [
  ROLES.WAREHOUSE_STAFF,
  ROLES.WAREHOUSE_MANAGER,
  ROLES.INVENTORY_ADMIN,
  ROLES.SUPER_ADMIN,
]

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.INVENTORY_ADMIN]: 'Admin Inventori',
  [ROLES.WAREHOUSE_MANAGER]: 'Manajer Gudang',
  [ROLES.WAREHOUSE_STAFF]: 'Staff Gudang',
}

/** First page each role can open after login (no dashboard). */
export const HOME_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: '/admin/setup',
  [ROLES.INVENTORY_ADMIN]: '/inventori/sku',
  [ROLES.WAREHOUSE_MANAGER]: '/sesi',
  [ROLES.WAREHOUSE_STAFF]: '/hitung',
}

export function getHomePath(role) {
  return HOME_BY_ROLE[role] || '/login'
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || '-'
}
