const bcrypt = require("bcryptjs");
const { onSuccess, onFailed, onError } = require("../helper/response");
const AuthModel = require("../models/auth.model");
const {
  signAuthToken,
  getCookieName,
  getCookieOptions,
} = require("../helper/jwt");

const INVALID_CREDENTIALS = "Invalid email or password";

function toPublicUser(row) {
  const warehouse =
    row.warehouse_id != null
      ? {
          id: row.warehouse_id,
          code: row.warehouse_code,
          name: row.warehouse_name,
        }
      : null;

  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    warehouse,
  };
}

const Login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return onFailed(res, null, "Email and password are required", 400);
    }

    const user = await AuthModel.findActiveUser(email);
    if (!user) {
      return onFailed(res, null, INVALID_CREDENTIALS, 401);
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return onFailed(res, null, INVALID_CREDENTIALS, 401);
    }

    const publicUser = toPublicUser(user);
    const { token, expiredAt } = await signAuthToken({
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name,
      warehouse_id: user.warehouse_id || null,
    });

    const cookieName = getCookieName();
    res.cookie(cookieName, token, getCookieOptions(expiredAt));

    // Token stays in httpOnly cookie only — never in JSON body (FSD).
    return onSuccess(res, { user: publicUser }, "Login successful");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const Logout = async (req, res) => {
  try {
    const cookieName = getCookieName();
    res.clearCookie(cookieName, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return onSuccess(res, null, "Logged out");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const Me = async (req, res) => {
  try {
    const payload = req.user || {};
    const user = {
      id: payload.id || payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      warehouse: payload.warehouse_id
        ? { id: payload.warehouse_id }
        : null,
    };

    return onSuccess(res, { user }, "OK");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

module.exports = { Login, Logout, Me };
