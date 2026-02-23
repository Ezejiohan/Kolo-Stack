const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const userRoute = require("./routes/userRoute");

const app = express();

/* =========================
   BODY PARSING (MUST BE FIRST)
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   OTHER MIDDLEWARES
========================= */
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

/* =========================
   ROUTES (AFTER BODY PARSER)
========================= */
app.use("/api/users", userRoute);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to KoloCircle API" });
});

module.exports = app;
