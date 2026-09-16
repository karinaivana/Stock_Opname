const express = require("express");
const router = express.Router();

const mw = require("../helper/middleware/token");
const requireRole = require("../helper/middleware/role");
const WarehouseController = require("../controllers/warehouse.controller.js");

router.get(
  "/",
  mw,
  requireRole("super_admin", "inventory_admin", "warehouse_manager"),
  WarehouseController.GetListWarehouse
);
router.post(
  "/", 
  mw, 
  requireRole("super_admin"), 
  WarehouseController.CreateNewWarehouse
);
router.patch(
  "/:id", 
  mw, 
  requireRole("super_admin"), 
  WarehouseController.UpdateWarehouse
);

module.exports = router;
