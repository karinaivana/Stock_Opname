const ACTIVE_STATUSES = ["COUNTING", "SUBMITTED", "APPROVED", "RECONCILING"];

const SESSION_STATUSES = [
  "COUNTING",
  "SUBMITTED",
  "APPROVED",
  "RECONCILING",
  "COMPLETED",
  "REJECTED",
  "FAILED",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = {
  ACTIVE_STATUSES,
  SESSION_STATUSES,
  UUID_PATTERN,
};
