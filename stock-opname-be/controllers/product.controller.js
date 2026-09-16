const { onFailed, onError, onSuccess } = require("../helper/response");
const ProductModel = require("../models/product.model");

const getListProduct = async (req, res) => {
  try {
    const result = await ProductModel.getListProduct(req.user, req.query);
    return onSuccess(res, result, "Successfully retrieved list of products");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await ProductModel.getProductById(req.user, req.params.id);
    return onSuccess(res, product, "Successfully retrieved product");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const createProduct = async (req, res) => {
  try {
    const product = await ProductModel.createProduct(req.user, req.body);
    return onSuccess(res, product, "Successfully created product", 201);
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await ProductModel.updateProduct(
      req.user,
      req.params.id,
      req.body
    );
    return onSuccess(res, product, "Successfully updated product");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

module.exports = {
  getListProduct,
  getProductById,
  createProduct,
  updateProduct,
};
