const express = require("express");
const router = express.Router();

const mw = require("../helper/middleware/token");
const requireRole = require("../helper/middleware/role");
const UserController = require("../controllers/user.controller");

router.get("/", mw, requireRole("super_admin"), UserController.getListUser);
router.post("/", mw, requireRole("super_admin"), UserController.createUser);
router.patch("/:id", mw, requireRole("super_admin"), UserController.updateUser);

module.exports = router;
