const onSuccess = (res, data, message = "OK", statusCode = 200) => {
  res.status(statusCode).json({
    status: true,
    data,
    message,
  });
};

const onFailed = (res, data, message = "Request failed", statusCode = 400) => {
  res.status(statusCode).json({
    status: false,
    data,
    message,
  });
};

const onError = (res, message = "Internal server error", statusCode = 500) => {
  res.status(statusCode).json({
    status: false,
    message,
  });
};

const onNotFound = (res, message = "Not found") => {
  res.status(404).json({
    status: false,
    message,
  });
};

module.exports = { onSuccess, onFailed, onError, onNotFound };
