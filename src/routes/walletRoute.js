const express = require("express");
const walletRouter = express.Router();

const { protect } = require("../middlewares/userMiddleware");
const { userLimiter } = require("../middlewares/userRateLimiter");
const requireKyc = require("../middlewares/requireKyc");

const { getWallet, deposit, withdraw } = require("../controllers/walletController");

walletRouter.get("/", protect, getWallet);      
walletRouter.post("/deposit", protect, userLimiter, deposit);
walletRouter.post("/withdraw", protect, userLimiter, requireKyc, withdraw);

module.exports = walletRouter;
