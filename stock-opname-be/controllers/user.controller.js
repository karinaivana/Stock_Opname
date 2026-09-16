const { onFailed, onError, onSuccess } = require("../helper/response");
const UserModel = require("../models/user.model");

const getListUser = async (req, res) => {
  try {
    const result = await UserModel.getListUser(req.user, req.query);
    return onSuccess(res, result, "Successfully retrieved list of users");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const createUser = async (req, res) => {
  try {
    const user = await UserModel.createUser(req.user, req.body);
    return onSuccess(res, user, "Successfully created user", 201);
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await UserModel.updateUser(req.user, req.params.id, req.body);
    return onSuccess(res, user, "Successfully updated user");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

module.exports = { 
  getListUser, 
  createUser, 
  updateUser 
};