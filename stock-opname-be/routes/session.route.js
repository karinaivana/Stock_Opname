const express = require("express");
const router = express.Router();

const mw = require("../helper/middleware/token");
const requireRole = require("../helper/middleware/role");
const SessionController = require("../controllers/session.controller");

router.get(
  "/",
  mw,
  requireRole("warehouse_staff", "warehouse_manager"),
  SessionController.List
);
router.get(
  "/candidates",
  mw,
  requireRole("warehouse_manager"),
  SessionController.GetCandidates
);
router.post("/", mw, requireRole("warehouse_manager"), SessionController.Create);
router.get(
  "/:id",
  mw,
  requireRole("warehouse_staff", "warehouse_manager"),
  SessionController.Get
);
router.post(
  "/:id/counts",
  mw,
  requireRole("warehouse_staff"),
  SessionController.SubmitCounts
);
router.get(
  "/:id/variances",
  mw,
  requireRole("warehouse_manager"),
  SessionController.GetVariances
);
router.post(
  "/:id/approve",
  mw,
  requireRole("warehouse_manager"),
  SessionController.Approve
);
router.post(
  "/:id/reject",
  mw,
  requireRole("warehouse_manager"),
  SessionController.Reject
);

module.exports = router;
