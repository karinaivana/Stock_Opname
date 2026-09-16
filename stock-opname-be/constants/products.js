const UNIQUE_CONSTRAINT_MESSAGES = {
  products_sku_key: "SKU code has already been used and cannot be reused",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SORT_COLUMNS = {
  sku: "p.sku",
  name: "p.name",
  base_uom: "p.base_uom",
};

module.exports = {
  UNIQUE_CONSTRAINT_MESSAGES,
  UUID_PATTERN,
  SORT_COLUMNS,
};
