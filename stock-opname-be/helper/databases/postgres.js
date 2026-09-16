const { Pool } = require("pg");
const dbConfig = require("../../config/databases");

let pool;

const createPool = async () => {
  pool = new Pool(dbConfig.postgres);
  await pool.query("SELECT 1");
  return pool;
};

const getConnection = () => {
  if (!pool) {
    throw new Error("PostgreSQL pool is not created");
  }
  return pool.connect();
};

const execute = async (sql, params = [], connection) => {
  const runner = connection || pool;
  if (!runner) {
    throw new Error(
      "PostgreSQL pool is not created. Set DATABASE_URL or DB_NAME/DB_USER and confirm the database is running."
    );
  }
  const result = await runner.query(sql, params);
  return result.rows;
};

const withTransaction = async (fn) => {
  const client = await getConnection();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { createPool, getConnection, execute, withTransaction };
