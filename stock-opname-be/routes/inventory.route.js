const express = require("express");
const router = express.Router();

const mw = require("../helper/middleware/token");
const requireRole = require("../helper/middleware/role");
const InventoryController = require("../controllers/inventory.controller");

router.get(
  "/:warehouseId",
  mw,
  requireRole("inventory_admin"),
  InventoryController.Get
);
router.put(
  "/:warehouseId",
  mw,
  requireRole("inventory_admin"),
  InventoryController.Update
);

module.exports = router;
