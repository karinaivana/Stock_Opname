const { onFailed } = require("../response");

module.exports = function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return onFailed(res, null, "Unauthorized", 401);
    }

    if (!roles.includes(req.user.role)) {
      return onFailed(res, null, "Forbidden", 403);
    }

    next();
  };
};
