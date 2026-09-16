function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapUniqueViolation(error, constraintMessages = {}) {
  if (error?.code !== "23505") return null;

  const message = constraintMessages[error.constraint];
  if (message) {
    return httpError(message, 409);
  }

  return httpError("Duplicate value violates a unique constraint", 409);
}

function rethrow(error, fallbackMessage = "Internal server error") {
  if (error?.statusCode) {
    throw error;
  }

  console.error(fallbackMessage, error);
  throw httpError(fallbackMessage, 500);
}

async function safeRollback(connection) {
  if (!connection) return;

  try {
    await connection.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("Failed to rollback transaction", rollbackError);
  }
}

module.exports = { httpError, mapUniqueViolation, rethrow, safeRollback };
