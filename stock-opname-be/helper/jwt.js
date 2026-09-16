const { SignJWT, jwtVerify } = require("jose");

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

function getExpiresAt() {
  const hours = Number(process.env.JWT_EXPIRES_HOURS || 8);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Sign session JWT with jose SignJWT (same approach as tms-web-app).
 * Claims follow Stock Opname FSD: sub, role, email (+ name / warehouse for UI).
 */
async function signAuthToken(claims) {
  const expiredAt = getExpiresAt();

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiredAt)
    .sign(getSecretKey());

  return { token, expiredAt };
}

async function verifyAuthToken(token) {
  const { payload } = await jwtVerify(token, getSecretKey());
  return payload;
}

function getCookieName() {
  return process.env.COOKIE_NAME || "so_session";
}

function getCookieOptions(expiredAt) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiredAt,
  };
}

module.exports = {
  signAuthToken,
  verifyAuthToken,
  getCookieName,
  getCookieOptions,
};
