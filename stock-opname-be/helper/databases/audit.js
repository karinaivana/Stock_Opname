const { httpError, rethrow } = require("../utils/error");

async function setAuditUser(connection, user) {
  try {
    const fullName = user?.name;
    if (!fullName) {
      throw httpError(
        "Authenticated user name is required for audit fields",
        401
      );
    }

    await connection.query(
      `SELECT set_config('app.current_user_name', $1, true)`,
      [fullName]
    );
  } catch (error) {
    rethrow(error, "Failed to set audit user");
  }
}

module.exports = { setAuditUser };
