const express = require("express");
const adminRouter = express.Router();
const { protect, authorize } = require("../middlewares/userMiddleware");
const { getPlatformStats, makeUserAdmin } = require("../controllers/admin/adminController");

adminRouter.get("/stats", protect, authorize("admin"), getPlatformStats);
adminRouter.patch("/users/:userId/make-admin", protect, authorize("admin"), makeUserAdmin);

module.exports = adminRouter;