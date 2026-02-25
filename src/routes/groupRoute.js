const express = require("express");
const groupRouter = express.Router();
const { protect } = require("../middlewares/userMiddleware");
const {
  createGroup,
  joinGroup,
  getMyGroups,
  contribute
} = require("../controllers/groupsController");

groupRouter.post("/", protect, createGroup);
groupRouter.post("/:id/join", protect, joinGroup);
groupRouter.get("/", protect, getMyGroups);
groupRouter.post("/:id/contribute", protect, contribute);

module.exports = groupRouter;
