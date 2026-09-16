const postgres = require("../helper/databases/postgres");
const { httpError, rethrow } = require("../helper/utils/error");
const { trimString } = require("../helper/utils/normalize");
const { ROLES } = require("../constants/roles");
const { UUID_PATTERN } = require("../constants/sessions");

const AUDIT_LOG_LIMIT = 50;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertWarehouseId(id) {
  const value = trimString(id);
  if (!value) {
    throw httpError("warehouseId is required", 400);
  }
  if (!UUID_PATTERN.test(value)) {
    throw httpError("warehouseId is invalid", 400);
  }
  return value;
}

function toPublicLog(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    session_code: row.session_code,
    sku: row.sku,
    product_name: row.product_name,
    qty_before: toNumber(row.qty_before),
    qty_after: toNumber(row.qty_after),
    base_uom: row.base_uom,
    approved_by_name: row.approved_by_name,
    warehouse: {
      id: row.warehouse_id,
      code: row.warehouse_code,
      name: row.warehouse_name,
    },
  };
}

async function assertWarehouseAccess(user, warehouseId) {
  const id = assertWarehouseId(warehouseId);

  const warehouseRows = await postgres.execute(
    `
      SELECT id, code, name, is_active
      FROM warehouses
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  const warehouse = warehouseRows[0];
  if (!warehouse) {
    throw httpError("Warehouse not found", 404);
  }

  if (user?.role === ROLES.WAREHOUSE_MANAGER) {
    const assignedId = trimString(user.warehouse_id);
    if (!assignedId) {
      throw httpError("User is not assigned to a warehouse", 403);
    }
    if (assignedId !== id) {
      throw httpError("Forbidden for this warehouse", 403);
    }
  }

  return warehouse;
}

async function list(user, warehouseId) {
  try {
    const warehouse = await assertWarehouseAccess(user, warehouseId);

    const rows = await postgres.execute(
      `
        SELECT
          l.id,
          l.created_at,
          l.qty_before,
          l.qty_after,
          l.warehouse_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          s.code AS session_code,
          p.sku,
          p.name AS product_name,
          p.base_uom,
          u.full_name AS approved_by_name
        FROM inventory_audit_logs l
        JOIN warehouses w ON w.id = l.warehouse_id
        JOIN audit_sessions s ON s.id = l.session_id
        JOIN products p ON p.id = l.product_id
        JOIN users u ON u.id = l.approved_by
        WHERE l.warehouse_id = $1
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT $2
      `,
      [warehouse.id, AUDIT_LOG_LIMIT]
    );

    return {
      warehouse: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
      },
      items: rows.map(toPublicLog),
      total: rows.length,
      limit: AUDIT_LOG_LIMIT,
    };
  } catch (error) {
    rethrow(error, "Failed to retrieve audit logs");
  }
}

module.exports = { list, AUDIT_LOG_LIMIT };
