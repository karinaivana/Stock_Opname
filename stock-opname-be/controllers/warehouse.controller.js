const { onFailed, onError, onSuccess } = require("../helper/response");
const WarehouseModel = require("../models/warehouse.model");

const GetListWarehouse = async (req, res) => {
  try {
    const result = await WarehouseModel.GetListWarehouse(req.user, req.query);

    return onSuccess(
      res,
      result,
      "Successfully retrieved list of warehouses"
    );
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const CreateNewWarehouse = async (req, res) => {
  try {
    const warehouse = await WarehouseModel.CreateNewWarehouse(
      req.user,
      req.body
    );
    return onSuccess(res, warehouse, "Successfully created new warehouse", 201);
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const UpdateWarehouse = async (req, res) => {
  try {
    const warehouse = await WarehouseModel.UpdateWarehouse(
      req.user,
      req.params.id,
      req.body
    );
    return onSuccess(res, warehouse, "Successfully updated warehouse");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

module.exports = {
  GetListWarehouse,
  CreateNewWarehouse,
  UpdateWarehouse,
};
