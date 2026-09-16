const postgres = require("../helper/databases/postgres");
const { rethrow } = require("../helper/utils/error");

async function syncUserWarehouse(userId, warehouseId, client) {
  try {
    await postgres.execute(
      `DELETE FROM user_warehouses WHERE user_id = $1`,
      [userId],
      client
    );

    if (!warehouseId) return;

    await postgres.execute(
      `
        INSERT INTO user_warehouses (user_id, warehouse_id)
        VALUES ($1, $2)
      `,
      [userId, warehouseId],
      client
    );
  } catch (error) {
    rethrow(error, "Failed to assign user warehouse");
  }
}

module.exports = { syncUserWarehouse };
