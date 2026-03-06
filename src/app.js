const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

/* =========================
   CREATE APP FIRST
========================= */
const app = express();

/* =========================
   BODY PARSING (FIRST)
========================= */
// Webhook routes need raw body for signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   SECURITY & LOGGING
========================= */
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

/* =========================
   RATE LIMITER
========================= */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

/* =========================
   ROUTES
========================= */
const userRoute = require("./routes/userRoute");
const adminRoute = require("./routes/adminRoute");
const groupRoute = require("./routes/groupRoute");
const walletRoute = require("./routes/walletRoute");
const kycRoute = require("./routes/kyc/kycRoute");
const paymentRoute = require("./routes/paymentRoute");

app.use("/api/users", userRoute);
app.use("/api/admin", adminRoute);
app.use("/api/groups", groupRoute);
app.use("/api/wallet", walletRoute);
app.use("/api/kyc", kycRoute);
app.use("/api/payments", paymentRoute);

/* =========================
   ROOT ROUTE
========================= */
app.get("/", (req, res) => {
  res.json({ message: "Welcome to KoloCircle API" });
});

/* =========================
   ERROR HANDLER (MUST BE LAST)
========================= */
const { errorHandler } = require("./middlewares/errorMiddleware");
app.use(errorHandler);

module.exports = app;
