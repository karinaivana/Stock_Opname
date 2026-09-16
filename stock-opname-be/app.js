require("dotenv").config();

const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");

const postgres = require("./helper/databases/postgres");
const dbConfig = require("./config/databases");

const app = express();

app.disable("x-powered-by");
app.use(logger("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || defaultOrigins.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (no Origin header).
      if (!origin) {
        return callback(null, true);
      }

      // Local/dev: reflect any Origin so LAN IP (e.g. 192.168.x.x) works.
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);

if (dbConfig.isPostgresConfigured()) {
  postgres
    .createPool()
    .then(() => {
      console.log("PostgreSQL pool created");
    })
    .catch((err) => {
      console.error("Failed to create PostgreSQL pool:", err.message);
    });
} else {
  console.error(
    "PostgreSQL is not configured. Set DATABASE_URL or DB_NAME and DB_USER."
  );
}

app.use("/", require("./routes/index"));

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const payload = {
    status: false,
    message: err.message || "Internal server error",
  };

  if (process.env.NODE_ENV === "development") {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
});

module.exports = app;
