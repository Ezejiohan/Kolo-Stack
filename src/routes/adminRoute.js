const express = require("express");
const adminRouter = express.Router();
const { protect, authorize } = require("../middlewares/userMiddleware");
const { getPlatformStats } = require("../controllers/admin/adminController");

adminRouter.get("/stats", protect, authorize("admin", "super_admin"), getPlatformStats);

module.exports = adminRouter;
