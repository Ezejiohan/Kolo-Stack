const express = require("express");
const adminRouter = express.Router();
const { protect, authorize } = require("../middlewares/userMiddleware");
const { getPlatformStats, makeUserAdmin } = require("../controllers/admin/adminController");

adminRouter.get("/stats", protect, authorize("admin"), getPlatformStats);

// FIX: Added `authorize("admin")` — previously any authenticated user could
//      call this endpoint and elevate any account (including their own) to admin.
adminRouter.patch("/users/:userId/make-admin", protect, authorize("admin"), makeUserAdmin);

module.exports = adminRouter;