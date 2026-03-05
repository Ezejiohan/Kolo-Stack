const express = require("express");
const kycRouter = express.Router();
const { protect } = require("../../middlewares/userMiddleware");
const { submitKYC } = require("../../controllers/kyc/kycController");

kycRouter.post("/submit", protect, submitKYC);

module.exports = kycRouter;
