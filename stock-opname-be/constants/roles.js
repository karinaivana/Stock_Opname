const ROLES = {
  SUPER_ADMIN: "super_admin",
  INVENTORY_ADMIN: "inventory_admin",
  WAREHOUSE_MANAGER: "warehouse_manager",
  WAREHOUSE_STAFF: "warehouse_staff",
};

const ALLOWED_ROLES = new Set(Object.values(ROLES));

const WAREHOUSE_SCOPED_ROLES = new Set([
  ROLES.WAREHOUSE_MANAGER,
  ROLES.WAREHOUSE_STAFF,
]);

module.exports = {
  ROLES,
  ALLOWED_ROLES,
  WAREHOUSE_SCOPED_ROLES,
};
