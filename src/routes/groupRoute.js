const express = require("express");
const groupRouter = express.Router();
const { protect, authorize } = require("../middlewares/userMiddleware");
const {
  createGroup,
  joinGroup,
  getMyGroups,
  contribute,
  sendInvite,
  acceptInvite
} = require("../controllers/groupsController");

const {
  initializeCycle,
  recordContribution,
  getGroupStats,
  getMemberHistory,
  getNextRecipient,
  completeCycle,
  checkCycle
} = require("../controllers/contributionsController");

groupRouter.post("/", protect, authorize("admin"), createGroup);
groupRouter.post("/:id/join", protect, joinGroup);
groupRouter.get("/", protect, getMyGroups);
groupRouter.post("/:id/contribute", protect, contribute);

// invite system
// owner can send invite to an email address
groupRouter.post("/:id/invite", protect, sendInvite);
// user accepts invite (must be authenticated)
groupRouter.post("/invite/accept/:token", protect, acceptInvite);

// contribution/rotation management
// only group owner should initialize cycle
groupRouter.post("/:groupId/cycles", protect, initializeCycle);

// record contribution after payment
groupRouter.post("/:groupId/contributions", protect, recordContribution);

// get group stats (optional cycle query param)
groupRouter.get("/:groupId/stats", protect, getGroupStats);

// member view of their own history
groupRouter.get("/:groupId/history", protect, getMemberHistory);

// rotation helpers
groupRouter.get("/:groupId/next-recipient", protect, getNextRecipient);

// complete cycle (owner)
groupRouter.patch("/cycles/:cycleId/complete", protect, completeCycle);

// check cycle completion
// groupId and cycleNumber in path
groupRouter.get("/:groupId/cycles/:cycleNumber/check", protect, checkCycle);

module.exports = groupRouter;
