const express = require("express");
const router = express.Router();

const mw = require("../helper/middleware/token");
const requireRole = require("../helper/middleware/role");
const ProductController = require("../controllers/product.controller");

router.get(
  "/",
  mw,
  requireRole("inventory_admin"),
  ProductController.getListProduct
);
router.post(
  "/",
  mw,
  requireRole("inventory_admin"),
  ProductController.createProduct
);
router.get(
  "/:id",
  mw,
  requireRole("inventory_admin"),
  ProductController.getProductById
);
router.patch(
  "/:id",
  mw,
  requireRole("inventory_admin"),
  ProductController.updateProduct
);

module.exports = router;
