require("dotenv").config();

function isPostgresConfigured() {
  return Boolean(
    process.env.DB_NAME && process.env.DB_USER
  );
}

function postgresConfig() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

module.exports = {
  postgres: postgresConfig(),
  isPostgresConfigured,
};
