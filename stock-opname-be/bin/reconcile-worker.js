#!/usr/bin/env node
require("dotenv").config();

const postgres = require("../helper/databases/postgres");
const dbConfig = require("../config/databases");
const { startReconcileWorker } = require("../workers/reconcile");

async function main() {
  if (!dbConfig.isPostgresConfigured()) {
    console.error(
      "PostgreSQL is not configured. Set DB_NAME and DB_USER (see .env.example)."
    );
    process.exit(1);
  }

  try {
    await postgres.createPool();
    console.log("PostgreSQL pool created");
  } catch (error) {
    console.error("Failed to create PostgreSQL pool:", error.message);
    process.exit(1);
  }

  await startReconcileWorker();
  process.exit(0);
}

main().catch((error) => {
  console.error("Reconcile worker crashed:", error);
  process.exit(1);
});
