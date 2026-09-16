function trimString(value) {
  return String(value ?? "").trim();
}

function normalizeCode(value) {
  return trimString(value).toUpperCase();
}

function normalizeEmail(value) {
  return trimString(value).toLowerCase();
}

function parseIsActive(value, defaultValue = true) {
  if (value === undefined) return defaultValue;
  return Boolean(value);
}

function parseNullableId(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function parseListParams(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  const q = trimString(query.q);

  return { page, limit, offset, q };
}

function parseActiveStatus(status) {
  const value = trimString(status || "ALL").toUpperCase();

  if (value === "AKTIF" || value === "ACTIVE" || value === "TRUE") {
    return true;
  }

  if (value === "NONAKTIF" || value === "INACTIVE" || value === "FALSE") {
    return false;
  }

  return null;
}

module.exports = {
  trimString,
  normalizeCode,
  normalizeEmail,
  parseIsActive,
  parseNullableId,
  parseListParams,
  parseActiveStatus,
};
