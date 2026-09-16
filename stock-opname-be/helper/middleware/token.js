const { onFailed } = require("../response");
const { verifyAuthToken, getCookieName } = require("../jwt");

function readToken(req) {
  const cookieName = getCookieName();
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }

  return null;
}

module.exports = async function tokenMiddleware(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) {
      return onFailed(res, null, "Unauthorized", 401);
    }

    const payload = await verifyAuthToken(token);
    req.user = {
      id: payload.id || payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      warehouse_id: payload.warehouse_id || null,
    };
    next();
  } catch (error) {
    return onFailed(res, null, "Unauthorized", 401);
  }
};
