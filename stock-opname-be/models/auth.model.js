const postgres = require("../helper/databases/postgres");
const { normalizeEmail } = require("../helper/utils/normalize");
const { rethrow } = require("../helper/utils/error");

/**
 * Active user by email + optional assigned warehouse (manager/staff).
 */
async function findActiveUser(email) {
  try {
    const sql = `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.password_hash,
        u.role,
        u.is_active,
        w.id   AS warehouse_id,
        w.code AS warehouse_code,
        w.name AS warehouse_name
      FROM users u
      LEFT JOIN user_warehouses uw ON uw.user_id = u.id
      LEFT JOIN warehouses w ON w.id = uw.warehouse_id AND w.is_active = true
      WHERE lower(u.email) = lower($1)
        AND u.is_active = true
      ORDER BY w.code ASC NULLS LAST
      LIMIT 1
    `;

    const rows = await postgres.execute(sql, [normalizeEmail(email)]);
    return rows[0] || null;
  } catch (error) {
    rethrow(error, "Failed to look up user");
  }
}

module.exports = { findActiveUser };
