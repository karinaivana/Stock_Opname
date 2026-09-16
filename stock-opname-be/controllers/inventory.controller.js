const { onFailed, onError, onSuccess } = require("../helper/response");
const InventoryModel = require("../models/inventory.model");

const Get = async (req, res) => {
  try {
    const result = await InventoryModel.getByWarehouse(
      req.user,
      req.params.warehouseId
    );
    return onSuccess(
      res,
      result,
      "Successfully retrieved inventory balances"
    );
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const Update = async (req, res) => {
  try {
    const result = await InventoryModel.setOpeningStock(
      req.user,
      req.params.warehouseId,
      req.body
    );
    return onSuccess(res, result, "Successfully set opening stock", 201);
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

module.exports = { Get, Update };
