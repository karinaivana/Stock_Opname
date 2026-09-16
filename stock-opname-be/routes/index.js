const express = require("express");
const router = express.Router();

const GeneralController = require("../controllers/general.controller");

router.get("/health", GeneralController.Health);

router.use("/auth", require("./auth.route"));
router.use("/warehouses", require("./warehouse.route"));
router.use("/users", require("./user.route"));
router.use("/products", require("./product.route"));
router.use("/inventory", require("./inventory.route"));
router.use("/sessions", require("./session.route"));
router.use("/audit-logs", require("./auditLog.route"));

module.exports = router;
