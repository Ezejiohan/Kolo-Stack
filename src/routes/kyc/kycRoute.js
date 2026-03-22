const express = require("express");
const kycRouter = express.Router();
const { protect, authorize } = require("../../middlewares/userMiddleware");
const { submitKYC, reviewKYC } = require("../../controllers/kyc/kycController");

kycRouter.post("/submit", protect, submitKYC);

// FIX: New admin-only endpoint to approve or reject KYC submissions
kycRouter.patch("/:kycId/review", protect, authorize("admin"), reviewKYC);

module.exports = kycRouter;