const { onFailed, onError, onSuccess } = require("../helper/response");
const AuditLogModel = require("../models/auditLog.model");

const List = async (req, res) => {
  try {
    const warehouseId = req.query.warehouseId || req.query.warehouse_id;
    if (!warehouseId) {
      return onFailed(res, null, "warehouseId is required", 400);
    }

    const result = await AuditLogModel.list(req.user, warehouseId);
    return onSuccess(res, result, "Successfully retrieved audit logs");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

module.exports = { List };
