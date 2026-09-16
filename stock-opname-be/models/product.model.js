const postgres = require("../helper/databases/postgres");
const { setAuditUser } = require("../helper/databases/audit");
const {
  httpError,
  mapUniqueViolation,
  rethrow,
  safeRollback,
} = require("../helper/utils/error");
const {
  trimString,
  normalizeCode,
  parseIsActive,
  parseListParams,
  parseActiveStatus,
} = require("../helper/utils/normalize");
const {
  UNIQUE_CONSTRAINT_MESSAGES,
  UUID_PATTERN,
  SORT_COLUMNS,
} = require("../constants/products");

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function toPublicProduct(row) {
  if (!row) return null;

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    base_uom: row.base_uom,
    is_active: row.is_active,
    count_types: parseCountTypesJson(row.count_types).map((item) => ({
      uom: item.uom,
      factor_to_base: toNumber(item.factor_to_base),
      sort_order: Number(item.sort_order) || 0,
      is_base: Boolean(item.is_base),
    })),
  };
}

function parseSort(query = {}) {
  const sortKey = trimString(query.sort || "sku");
  const column = SORT_COLUMNS[sortKey] || SORT_COLUMNS.sku;
  const order =
    trimString(query.order || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  return {
    column,
    order,
    sort: SORT_COLUMNS[sortKey] ? sortKey : "sku",
  };
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

function normalizeCountTypes(raw = [], baseUom) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw httpError("At least one count type is required", 400);
  }

  const seen = new Set();
  const types = raw.map((item, index) => {
    const uom = trimString(item?.uom ?? item?.name).toLowerCase();
    const factor = Number(item?.factor_to_base ?? item?.factorToBase);
    const isBase = Boolean(item?.is_base ?? item?.isBase);

    if (!uom) {
      throw httpError("Count type unit is required", 400);
    }
    if (!Number.isFinite(factor) || factor <= 0) {
      throw httpError("Count type factor must be greater than 0", 400);
    }

    if (seen.has(uom)) {
      throw httpError("Count type units must be unique per SKU", 400);
    }
    seen.add(uom);

    return {
      uom,
      factorToBase: Math.round(factor * 1000) / 1000,
      isBase,
      sortOrder: Number.isInteger(item?.sort_order)
        ? item.sort_order
        : index,
    };
  });

  const bases = types.filter((item) => item.isBase);
  if (bases.length !== 1) {
    throw httpError("Exactly one count type must be the base unit", 400);
  }
  if (bases[0].uom !== baseUom) {
    throw httpError("Base count type must match the SKU base unit", 400);
  }
  if (bases[0].factorToBase !== 1) {
    throw httpError("Base count type factor must be 1", 400);
  }

  return types;
}

function normalizePayload(body = {}) {
  const sku = normalizeCode(body.sku ?? body.code);
  const name = trimString(body.name);
  const baseUom = trimString(body.base_uom ?? body.baseUom).toLowerCase();
  const isActive = parseIsActive(body.is_active);
  const countTypes = normalizeCountTypes(
    body.count_types ?? body.countTypes,
    baseUom
  );

  if (!sku) {
    throw httpError("SKU code is required", 400);
  }
  if (!name) {
    throw httpError("Product name is required", 400);
  }
  if (!baseUom) {
    throw httpError("Base unit is required", 400);
  }

  return { sku, name, baseUom, isActive, countTypes };
}

const PRODUCT_SELECT = `
  SELECT
    p.id,
    p.sku,
    p.name,
    p.base_uom,
    p.is_active,
    COALESCE(
      json_agg(
        json_build_object(
          'uom', pct.uom,
          'factor_to_base', pct.factor_to_base,
          'sort_order', pct.sort_order,
          'is_base', pct.is_base
        )
        ORDER BY pct.is_base ASC, pct.sort_order ASC, pct.uom ASC
      ) FILTER (WHERE pct.uom IS NOT NULL),
      '[]'::json
    ) AS count_types
  FROM products p
  LEFT JOIN product_count_types pct ON pct.product_id = p.id
`;

async function findById(id, client) {
  try {
    const rows = await postgres.execute(
      `
        ${PRODUCT_SELECT}
        WHERE p.id = $1
        GROUP BY p.id
        LIMIT 1
      `,
      [id],
      client
    );
    return rows[0] || null;
  } catch (error) {
    rethrow(error, "Failed to look up product");
  }
}

async function getProductBySku(sku, client) {
  try {
    const rows = await postgres.execute(
      `SELECT id, sku FROM products WHERE sku = $1 LIMIT 1`,
      [sku],
      client
    );
    return rows[0] || null;
  } catch (error) {
    rethrow(error, "Failed to look up product");
  }
}

async function replaceCountTypes(productId, countTypes, client) {
  await postgres.execute(
    `DELETE FROM product_count_types WHERE product_id = $1`,
    [productId],
    client
  );

  for (const item of countTypes) {
    await postgres.execute(
      `
        INSERT INTO product_count_types (
          product_id, uom, factor_to_base, sort_order, is_base
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [productId, item.uom, item.factorToBase, item.sortOrder, item.isBase],
      client
    );
  }
}

async function getListProduct(_user, query = {}) {
  try {
    const { page, limit, offset, q } = parseListParams(query);
    const isActive = parseActiveStatus(query.status);
    const baseUom = trimString(query.base_uom || query.baseUom).toLowerCase();
    const { column, order, sort } = parseSort(query);

    const params = [];
    const where = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length})`
      );
    }

    if (isActive !== null) {
      params.push(isActive);
      where.push(`p.is_active = $${params.length}`);
    }

    if (baseUom) {
      params.push(baseUom);
      where.push(`p.base_uom = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRows = await postgres.execute(
      `
        SELECT COUNT(*)::int AS total
        FROM products p
        ${whereSql}
      `,
      params
    );
    const total = countRows[0]?.total || 0;

    params.push(limit);
    params.push(offset);

    const rows = await postgres.execute(
      `
        ${PRODUCT_SELECT}
        ${whereSql}
        GROUP BY p.id
        ORDER BY ${column} ${order}, p.sku ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return {
      items: rows.map(toPublicProduct),
      total,
      page,
      limit,
      sort,
      order: order.toLowerCase(),
    };
  } catch (error) {
    rethrow(error, "Failed to retrieve products");
  }
}

async function getProductById(_user, id) {
  try {
    const productId = assertProductId(id);
    const row = await findById(productId);
    if (!row) {
      throw httpError("Product not found", 404);
    }
    return toPublicProduct(row);
  } catch (error) {
    rethrow(error, "Failed to retrieve product");
  }
}

async function createProduct(user, body) {
  const payload = normalizePayload(body);
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, user);

    const existing = await getProductBySku(payload.sku, connection);
    if (existing) {
      throw httpError(
        "SKU code has already been used and cannot be reused",
        409
      );
    }

    const rows = await postgres.execute(
      `
        INSERT INTO products (sku, name, base_uom, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [payload.sku, payload.name, payload.baseUom, payload.isActive],
      connection
    );

    const created = rows[0];
    await replaceCountTypes(created.id, payload.countTypes, connection);

    const full = await findById(created.id, connection);
    await connection.query("COMMIT");
    return toPublicProduct(full);
  } catch (error) {
    await safeRollback(connection);
    const mapped = mapUniqueViolation(error, UNIQUE_CONSTRAINT_MESSAGES);
    if (mapped) throw mapped;
    rethrow(error, "Failed to create product");
  } finally {
    connection.release();
  }
}

async function updateProduct(user, id, body) {
  const productId = assertProductId(id);
  const payload = normalizePayload(body);
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, user);

    const existing = await findById(productId, connection);
    if (!existing) {
      throw httpError("Product not found", 404);
    }

    if (payload.sku !== existing.sku) {
      throw httpError("SKU code cannot be changed", 400);
    }

    await postgres.execute(
      `
        UPDATE products
        SET name = $1,
            base_uom = $2,
            is_active = $3
        WHERE id = $4
      `,
      [payload.name, payload.baseUom, payload.isActive, productId],
      connection
    );

    await replaceCountTypes(productId, payload.countTypes, connection);

    const full = await findById(productId, connection);
    await connection.query("COMMIT");
    return toPublicProduct(full);
  } catch (error) {
    await safeRollback(connection);
    const mapped = mapUniqueViolation(error, UNIQUE_CONSTRAINT_MESSAGES);
    if (mapped) throw mapped;
    rethrow(error, "Failed to update product");
  } finally {
    connection.release();
  }
}

module.exports = {
  getListProduct,
  getProductById,
  createProduct,
  updateProduct,
};
