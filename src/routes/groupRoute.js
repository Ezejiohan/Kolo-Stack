const express = require("express");
const groupRouter = express.Router();
const { protect } = require("../middlewares/userMiddleware");
const {
  createGroup,
  joinGroup,
  getMyGroups,
  contribute,
  sendInvite,
  acceptInvite,
} = require("../controllers/groupsController");

const {
  initializeCycle,
  recordContribution,
  getGroupStats,
  getMemberHistory,
  getNextRecipient,
  completeCycle,
  checkCycle,
} = require("../controllers/contributionsController");

// FIX: Removed `authorize("admin")` — regular authenticated users should be
//      able to create groups. Using admin-only gate locked out all normal users.
groupRouter.post("/", protect, createGroup);

groupRouter.post("/:id/join", protect, joinGroup);
groupRouter.get("/", protect, getMyGroups);
groupRouter.post("/:id/contribute", protect, contribute);

// Invite system
groupRouter.post("/:id/invite", protect, sendInvite);
// FIX: Invite accept route must be registered BEFORE /:id routes to avoid
//      "invite" being matched as a groupId
groupRouter.post("/invite/accept/:token", protect, acceptInvite);

// Contribution / rotation management
groupRouter.post("/:groupId/cycles", protect, initializeCycle);
groupRouter.post("/:groupId/contributions", protect, recordContribution);
groupRouter.get("/:groupId/stats", protect, getGroupStats);
groupRouter.get("/:groupId/history", protect, getMemberHistory);
groupRouter.get("/:groupId/next-recipient", protect, getNextRecipient);

// FIX: Complete-cycle route uses /cycles/:cycleId — must be defined before
//      /:groupId/cycles/:cycleNumber/check to avoid routing ambiguity
groupRouter.patch("/cycles/:cycleId/complete", protect, completeCycle);
groupRouter.get("/:groupId/cycles/:cycleNumber/check", protect, checkCycle);

module.exports = groupRouter;