  const postgres = require("../helper/databases/postgres");
  const { setAuditUser } = require("../helper/databases/audit");
  const { httpError, rethrow, safeRollback } = require("../helper/utils/error");
  const {
    trimString,
    normalizeCode,
    parseIsActive,
    parseListParams,
    parseActiveStatus,
  } = require("../helper/utils/normalize");

  function normalizePayload(body = {}) {
    const code = normalizeCode(body.code);
    const name = trimString(body.name);
    const location = trimString(body.description ?? body.location);
    const isActive = parseIsActive(body.is_active);

    return { code, name, location, isActive };
  }

  async function GetListWarehouse(user, query = {}) {
    try {
      const { page, limit, offset, q } = parseListParams(query);
      const isActive = parseActiveStatus(query.status);

      const params = [];
      const where = [];

      if (user?.role === "warehouse_manager") {
        const warehouseId = String(user.warehouse_id || "").trim();
        if (!warehouseId) {
          throw httpError("User is not assigned to a warehouse", 403);
        }
        params.push(warehouseId);
        where.push(`w.id = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        where.push(
          `(w.code ILIKE $${params.length} OR w.name ILIKE $${params.length})`
        );
      }

      if (isActive !== null) {
        params.push(isActive);
        where.push(`w.is_active = $${params.length}`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const countRows = await postgres.execute(
        `
          SELECT COUNT(*)::int AS total
          FROM warehouses w
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
            w.id,
            w.code,
            w.name,
            w.location AS description,
            w.is_active,
            COUNT(u.id)::int AS user_count
          FROM warehouses w
          LEFT JOIN user_warehouses uw ON uw.warehouse_id = w.id
          LEFT JOIN users u ON u.id = uw.user_id
          ${whereSql}
          GROUP BY w.id
          ORDER BY w.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return {
        items: rows,
        total,
        page,
        limit,
      };
    } catch (error) {
      rethrow(error, "Failed to retrieve warehouses");
    }
  }

  async function getWarehouseByCode(code, client) {
    try {
      const rows = await postgres.execute(
        `SELECT id, code, is_active FROM warehouses WHERE code = $1 LIMIT 1`,
        [code],
        client
      );
      return rows[0] || null;
    } catch (error) {
      rethrow(error, "Failed to look up warehouse");
    }
  }

  async function findById(id, client) {
    try {
      const rows = await postgres.execute(
        `SELECT id, code, name, location, is_active FROM warehouses WHERE id = $1 LIMIT 1`,
        [id],
        client
      );
      return rows[0] || null;
    } catch (error) {
      rethrow(error, "Failed to look up warehouse");
    }
  }

  var validateCreateWarehouse = (body) => {
    try {
      const { code, name, location, isActive } = normalizePayload(body);

      if (!code) {
        throw httpError("Warehouse code is required", 400);
      }

      if(!name) {
        throw httpError("Warehouse name is required", 400);
      }

      if(isActive === undefined) {
        throw httpError("Warehouse active status is required", 400);
      }

      return { code, name, location, isActive };
    } catch (error) {
      rethrow(error, "Failed to validate warehouse");
    }
  }

  async function CreateNewWarehouse(user, body) {
    const { code, name, location, isActive } = validateCreateWarehouse(body);
    const connection = await postgres.getConnection();

    try {
      await connection.query("BEGIN");
      await setAuditUser(connection, user);

      const existing = await getWarehouseByCode(code, connection);
      if (existing) {
        throw httpError(
          "Warehouse code has already been used and cannot be reused",
          409
        );
      }

      const rows = await postgres.execute(
        `
          INSERT INTO warehouses (code, name, location, is_active)
          VALUES ($1, $2, $3, $4)
          RETURNING id, code, name, location AS description, is_active
        `,
        [code, name, location, isActive],
        connection
      );

      await connection.query("COMMIT");
      return rows[0];
    } catch (error) {
      await safeRollback(connection);
      rethrow(error, "Failed to create warehouse");
    } finally {
      connection.release();
    }
  }

  var validateUpdateWarehouse = (id, body, existing) => {
    try {
      if (!id) {
        throw httpError("Warehouse id is required", 400);
      }

      const { name, location, isActive } = normalizePayload(body);

      if (!name) {
        throw httpError("Warehouse name is required", 400);
      }

      if (body.code != null) {
        const nextCode = normalizeCode(body.code);
        if (nextCode && nextCode !== existing.code) {
          throw httpError("Warehouse code cannot be changed", 400);
        }
      }

      return { name, location, isActive };
    } catch (error) {
      rethrow(error, "Failed to validate warehouse");
    }
  }

  async function UpdateWarehouse(user, id, body) {
    const connection = await postgres.getConnection();

    try {
      await connection.query("BEGIN");
      await setAuditUser(connection, user);

      const existing = await findById(id, connection);
      if (!existing) {
        throw httpError("Warehouse not found", 404);
      }

      const { name, location, isActive } = validateUpdateWarehouse(
        id,
        body,
        existing
      );

      const rows = await postgres.execute(
        `
          UPDATE warehouses
          SET name = $1,
              location = $2,
              is_active = $3
          WHERE id = $4
          RETURNING id, code, name, location AS description, is_active
        `,
        [name, location, isActive, id],
        connection
      );

      await connection.query("COMMIT");
      return rows[0];
    } catch (error) {
      await safeRollback(connection);
      rethrow(error, "Failed to update warehouse");
    } finally {
      connection.release();
    }
  }

  async function FindWarehouseById(id, client) {
    try {
      if (!id) {
        throw httpError("Warehouse id is required", 400);
      }

      const query = `SELECT id, code, name, is_active FROM warehouses WHERE id = $1 LIMIT 1`;
      const params = [id];

      const rows = await postgres.execute(query, params, client);
      return rows[0] || null;
    } catch (error) {
      rethrow(error, "Failed to look up warehouse");
    }
  }

  module.exports = {
    GetListWarehouse,
    CreateNewWarehouse,
    UpdateWarehouse,
    FindWarehouseById,
  };
