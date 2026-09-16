const { onFailed, onError, onSuccess } = require("../helper/response");
const SessionModel = require("../models/session.model");

const List = async (req, res) => {
  try {
    const result = await SessionModel.list(req.user);
    return onSuccess(res, result, "Successfully retrieved sessions");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const GetCandidates = async (req, res) => {
  try {
    const result = await SessionModel.getCandidates(req.user);
    return onSuccess(res, result, "Successfully retrieved snapshot candidates");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const Create = async (req, res) => {
  try {
    const result = await SessionModel.create(req.user, req.body);
    return onSuccess(res, result, "Successfully created session snapshot", 201);
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const Get = async (req, res) => {
  try {
    const result = await SessionModel.getById(req.user, req.params.id);
    return onSuccess(res, result, "Successfully retrieved session");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const SubmitCounts = async (req, res) => {
  try {
    const result = await SessionModel.submitCounts(
      req.user,
      req.params.id,
      req.body
    );
    return onSuccess(
      res,
      result,
      "Successfully submitted counts. Official on-hand unchanged until approval."
    );
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const GetVariances = async (req, res) => {
  try {
    const result = await SessionModel.getVariances(req.user, req.params.id);
    return onSuccess(res, result, "Successfully retrieved variances");
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const Approve = async (req, res) => {
  try {
    const result = await SessionModel.approve(req.user, req.params.id);
    return onSuccess(
      res,
      result,
      result?.already_approved
        ? "Session already approved; reconciliation job unchanged"
        : "Session approved. Reconciliation queued asynchronously."
    );
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

const Reject = async (req, res) => {
  try {
    const result = await SessionModel.reject(
      req.user,
      req.params.id,
      req.body
    );
    return onSuccess(
      res,
      result,
      "Session rejected. Official on-hand unchanged."
    );
  } catch (error) {
    if (error.statusCode) {
      return onFailed(res, null, error.message, error.statusCode);
    }
    onError(res);
  }
};

module.exports = {
  List,
  GetCandidates,
  Create,
  Get,
  SubmitCounts,
  GetVariances,
  Approve,
  Reject,
};
