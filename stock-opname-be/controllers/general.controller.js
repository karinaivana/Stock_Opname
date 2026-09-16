const { onSuccess } = require("../helper/response");

const Health = (req, res) => {
  onSuccess(res, { service: "stock-opname-be" }, "OK");
};

module.exports = { Health };
