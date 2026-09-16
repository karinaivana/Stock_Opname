const express = require("express");
const router = express.Router();

const mw = require("../helper/middleware/token");
const requireRole = require("../helper/middleware/role");
const AuditLogController = require("../controllers/auditLog.controller");

router.get(
  "/",
  mw,
  requireRole("warehouse_manager", "inventory_admin", "super_admin"),
  AuditLogController.List
);

module.exports = router;
