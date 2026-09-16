const bcrypt = require("bcryptjs");

// models
const { FindWarehouseById } = require("./warehouse.model");
const { syncUserWarehouse } = require("./userWarehouse.model");

// helper
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
  normalizeEmail,
  parseIsActive,
  parseNullableId,
  parseListParams,
} = require("../helper/utils/normalize");

// constants
const {
  ALLOWED_ROLES,
  WAREHOUSE_SCOPED_ROLES,
} = require("../constants/roles");

const { 
  BCRYPT_ROUNDS, 
  UNIQUE_CONSTRAINT_MESSAGES 
} = require("../constants/users");

function needsWarehouse(role) {
  return WAREHOUSE_SCOPED_ROLES.has(role);
}

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    warehouse_id: row.warehouse_id || null,
    warehouse_name: row.warehouse_name || null,
    is_active: row.is_active,
  };
}

function normalizePayload(body = {}, { requirePassword } = {}) {
  const name = trimString(body.name ?? body.full_name);
  const email = normalizeEmail(body.email);
  const role = trimString(body.role);
  const password =
    body.password === undefined || body.password === null
      ? undefined
      : String(body.password);
  const isActive = parseIsActive(body.is_active);
  const warehouseId = parseNullableId(body.warehouse_id);

  if (!name) {
    throw httpError("Name is required", 400);
  }
  if (!email) {
    throw httpError("Email is required", 400);
  }

  if (requirePassword) {
    if (!password || !password.trim()) {
      throw httpError("Password is required", 400);
    }
  } else if (password !== undefined && !password.trim()) {
    throw httpError("Password cannot be empty", 400);
  }

  if (needsWarehouse(role)) {
    if (!warehouseId) {
      throw httpError("Warehouse is required for this role", 400);
    }
  }

  return {
    name,
    email,
    role,
    password: password ? password.trim() : undefined,
    isActive,
    warehouseId: needsWarehouse(role) ? warehouseId : null,
  };
}



async function FindUserById(id, client) {
  try {
    const rows = await postgres.execute(
      `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.role,
          u.is_active,
          w.id   AS warehouse_id,
          w.name AS warehouse_name
        FROM users u
        LEFT JOIN user_warehouses uw ON uw.user_id = u.id
        LEFT JOIN warehouses w ON w.id = uw.warehouse_id
        WHERE u.id = $1
        ORDER BY w.code ASC NULLS LAST
        LIMIT 1
      `,
      [id],
      client
    );
    return rows[0] || null;
  } catch (error) {
    rethrow(error, "Failed to look up user");
  }
}

async function assertWarehouseAssignable(warehouseId, client) {
  try {
    const warehouse = await FindWarehouseById(warehouseId, client);
    if (!warehouse) {
      throw httpError("Warehouse not found", 404);
    }
    if (!warehouse.is_active) {
      throw httpError("Warehouse is inactive and cannot be assigned", 400);
    }
    return warehouse;
  } catch (error) {
    rethrow(error, "Failed to validate warehouse assignment");
  }
}

async function getListUser(_user, query = {}) {
  try {
    const { page, limit, offset, q } = parseListParams(query);

    const roleValue = trimString(query.role || "ALL");
    const role = roleValue && roleValue !== "ALL" ? roleValue : null;
    const params = [];
    const where = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`
      );
    }

    if (role) {
      if (!ALLOWED_ROLES.has(role)) {
        throw httpError("Role is invalid", 400);
      }
      params.push(role);
      where.push(`u.role = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRows = await postgres.execute(
      `
        SELECT COUNT(*)::int AS total
        FROM users u
        ${whereSql}
      `,
      params
    );
    const total = countRows[0]?.total || 0;

    params.push(limit);
    params.push(offset);

    const rows = await postgres.execute(
      `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.role,
          u.is_active,
          w.id   AS warehouse_id,
          w.name AS warehouse_name
        FROM users u
        LEFT JOIN user_warehouses uw ON uw.user_id = u.id
        LEFT JOIN warehouses w ON w.id = uw.warehouse_id
        ${whereSql}
        ORDER BY u.created_at DESC, u.full_name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return {
      items: rows.map(toPublicUser),
      total,
      page,
      limit,
    };
  } catch (error) {
    rethrow(error, "Failed to retrieve users");
  }
}

async function createUser(actor, body) {
  const payload = normalizePayload(body, { requirePassword: true });
  const passwordHash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, actor);

    if (payload.warehouseId) {
      await assertWarehouseAssignable(payload.warehouseId, connection);
    }

    const rows = await postgres.execute(
      `
        INSERT INTO users (full_name, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, full_name, email, role, is_active
      `,
      [
        payload.name,
        payload.email,
        passwordHash,
        payload.role,
        payload.isActive,
      ],
      connection
    );

    const created = rows[0];
    await syncUserWarehouse(created.id, payload.warehouseId, connection);

    const full = await FindUserById(created.id, connection);
    await connection.query("COMMIT");
    return toPublicUser(full);
  } catch (error) {
    await safeRollback(connection);
    const mapped = mapUniqueViolation(error, UNIQUE_CONSTRAINT_MESSAGES);
    if (mapped) throw mapped;
    rethrow(error, "Failed to create user");
  } finally {
    connection.release();
  }
}

async function updateUser(actor, id, body) {
  if (!id) {
    throw httpError("User id is required", 400);
  }

  const payload = normalizePayload(body, { requirePassword: false });
  const actorId = actor?.id || actor?.sub;
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, actor);

    const existing = await FindUserById(id, connection);
    if (!existing) {
      throw httpError("User not found", 404);
    }

    if (
      actorId &&
      String(actorId) === String(id) &&
      payload.isActive === false
    ) {
      throw httpError("You cannot deactivate your own account", 400);
    }

    if (payload.warehouseId) {
      await assertWarehouseAssignable(payload.warehouseId, connection);
    }

    const params = [
      payload.name,
      payload.email,
      payload.role,
      payload.isActive,
      id,
    ];

    let sql = `
      UPDATE users
      SET full_name = $1,
          email = $2,
          role = $3,
          is_active = $4
    `;

    if (payload.password) {
      const passwordHash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
      params.splice(4, 0, passwordHash);
      sql += `, password_hash = $5 WHERE id = $6`;
    } else {
      sql += ` WHERE id = $5`;
    }

    sql += `
      RETURNING id, full_name, email, role, is_active
    `;

    await postgres.execute(sql, params, connection);
    await syncUserWarehouse(id, payload.warehouseId, connection);

    const full = await FindUserById(id, connection);
    await connection.query("COMMIT");
    return toPublicUser(full);
  } catch (error) {
    await safeRollback(connection);
    const mapped = mapUniqueViolation(error, UNIQUE_CONSTRAINT_MESSAGES);
    if (mapped) throw mapped;
    rethrow(error, "Failed to update user");
  } finally {
    connection.release();
  }
}

module.exports = { 
  getListUser, 
  createUser, 
  updateUser 
};
