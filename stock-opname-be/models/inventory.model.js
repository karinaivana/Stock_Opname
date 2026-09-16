const postgres = require("../helper/databases/postgres");
const { setAuditUser } = require("../helper/databases/audit");
const { httpError, rethrow, safeRollback } = require("../helper/utils/error");
const { trimString } = require("../helper/utils/normalize");
const { UUID_PATTERN } = require("../constants/products");

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCountTypesJson(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function assertWarehouseId(id) {
  const value = trimString(id);
  if (!value) {
    throw httpError("Warehouse id is required", 400);
  }
  if (!UUID_PATTERN.test(value)) {
    throw httpError("Warehouse id is invalid", 400);
  }
  return value;
}

function assertProductId(id) {
  const value = trimString(id);
  if (!value) {
    throw httpError("Product id is required", 400);
  }
  if (!UUID_PATTERN.test(value)) {
    throw httpError("Product id is invalid", 400);
  }
  return value;
}

function toPublicItem(row) {
  const qty = row.on_hand_qty == null ? null : toNumber(row.on_hand_qty);
  const filled = qty !== null;

  return {
    product_id: row.product_id,
    sku: row.sku,
    name: row.name,
    base_uom: row.base_uom,
    on_hand_qty: qty,
    is_filled: filled,
    count_types: parseCountTypesJson(row.count_types).map((item) => ({
      uom: item.uom,
      factor_to_base: toNumber(item.factor_to_base) ?? 0,
      sort_order: Number(item.sort_order) || 0,
      is_base: Boolean(item.is_base),
    })),
  };
}

function normalizeOpeningItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError("At least one opening stock item is required", 400);
  }

  const seen = new Set();
  const items = rawItems.map((item, index) => {
    const productId = assertProductId(item?.productId ?? item?.product_id);
    const qtyRaw = item?.onHandQty ?? item?.on_hand_qty;
    const onHandQty = toNumber(qtyRaw);

    if (seen.has(productId)) {
      throw httpError(`Duplicate product in opening stock payload (index ${index})`, 400);
    }
    seen.add(productId);

    if (qtyRaw === undefined || qtyRaw === null || qtyRaw === "") {
      throw httpError("Opening stock quantity is required", 400);
    }
    if (onHandQty === null) {
      throw httpError("Opening stock quantity must be a number", 400);
    }
    if (onHandQty < 0) {
      throw httpError("Opening stock quantity cannot be negative", 400);
    }

    return {
      productId,
      onHandQty: Math.round(onHandQty * 1000) / 1000,
    };
  });

  return items;
}

async function findWarehouse(warehouseId, client) {
  try {
    const rows = await postgres.execute(
      `
        SELECT id, code, name, is_active
        FROM warehouses
        WHERE id = $1
        LIMIT 1
      `,
      [warehouseId],
      client
    );
    return rows[0] || null;
  } catch (error) {
    rethrow(error, "Failed to look up warehouse");
  }
}

async function getByWarehouse(_user, warehouseId) {
  try {
    const id = assertWarehouseId(warehouseId);
    const warehouse = await findWarehouse(id);
    if (!warehouse) {
      throw httpError("Warehouse not found", 404);
    }

    const rows = await postgres.execute(
      `
        SELECT
          p.id AS product_id,
          p.sku,
          p.name,
          p.base_uom,
          ib.on_hand_qty,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'uom', pct.uom,
                  'factor_to_base', pct.factor_to_base,
                  'sort_order', pct.sort_order,
                  'is_base', pct.is_base
                )
                ORDER BY pct.is_base ASC, pct.sort_order ASC, pct.uom ASC
              )
              FROM product_count_types pct
              WHERE pct.product_id = p.id
            ),
            '[]'::json
          ) AS count_types
        FROM products p
        LEFT JOIN inventory_balances ib
          ON ib.product_id = p.id
         AND ib.warehouse_id = $1
        WHERE p.is_active = true
        ORDER BY p.sku ASC
      `,
      [id]
    );

    const items = rows.map(toPublicItem);
    const filledCount = items.filter((item) => item.is_filled).length;

    return {
      warehouse: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        is_active: warehouse.is_active,
      },
      items,
      summary: {
        total_sku: items.length,
        filled_count: filledCount,
        empty_count: items.length - filledCount,
      },
    };
  } catch (error) {
    rethrow(error, "Failed to retrieve inventory balances");
  }
}

async function setOpeningStock(user, warehouseId, body = {}) {
  const id = assertWarehouseId(warehouseId);
  const items = normalizeOpeningItems(body.items);
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, user);

    const warehouse = await findWarehouse(id, connection);
    if (!warehouse) {
      throw httpError("Warehouse not found", 404);
    }
    if (!warehouse.is_active) {
      throw httpError("Cannot set opening stock for an inactive warehouse", 400);
    }

    const productIds = items.map((item) => item.productId);
    const productRows = await postgres.execute(
      `
        SELECT id, sku, is_active
        FROM products
        WHERE id = ANY($1::uuid[])
      `,
      [productIds],
      connection
    );

    const productById = new Map(productRows.map((row) => [row.id, row]));
    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        throw httpError(`Product not found: ${item.productId}`, 404);
      }
      if (!product.is_active) {
        throw httpError(
          `Cannot set opening stock for inactive SKU ${product.sku}`,
          400
        );
      }
    }

    const existingRows = await postgres.execute(
      `
        SELECT ib.product_id, p.sku
        FROM inventory_balances ib
        JOIN products p ON p.id = ib.product_id
        WHERE ib.warehouse_id = $1
          AND ib.product_id = ANY($2::uuid[])
      `,
      [id, productIds],
      connection
    );

    if (existingRows.length > 0) {
      const skus = existingRows.map((row) => row.sku).join(", ");
      throw httpError(
        `Opening stock already set for SKU: ${skus}. Filled balances cannot be overwritten on this page.`,
        409
      );
    }

    const inserted = [];
    for (const item of items) {
      const rows = await postgres.execute(
        `
          INSERT INTO inventory_balances (warehouse_id, product_id, on_hand_qty)
          VALUES ($1, $2, $3)
          RETURNING warehouse_id, product_id, on_hand_qty
        `,
        [id, item.productId, item.onHandQty],
        connection
      );
      inserted.push({
        warehouse_id: rows[0].warehouse_id,
        product_id: rows[0].product_id,
        on_hand_qty: toNumber(rows[0].on_hand_qty),
      });
    }

    await connection.query("COMMIT");

    return {
      warehouse: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
      },
      inserted,
      count: inserted.length,
    };
  } catch (error) {
    await safeRollback(connection);
    rethrow(error, "Failed to set opening stock");
  } finally {
    connection.release();
  }
}

module.exports = { getByWarehouse, setOpeningStock };
