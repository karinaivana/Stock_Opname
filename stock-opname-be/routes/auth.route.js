const express = require("express");
const router = express.Router();

const mw = require("../helper/middleware/token");
const AuthController = require("../controllers/auth.controller");

router.post("/login", AuthController.Login);
// Logout does not require a valid JWT so expired sessions can still clear the cookie.
router.post("/logout", AuthController.Logout);
router.get("/me", mw, AuthController.Me);

module.exports = router;
