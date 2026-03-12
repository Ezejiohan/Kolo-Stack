const cron = require("node-cron");
const Group = require("../groups/groupModel");
const Contribution = require("../contributions/contributionModel");
const { sendMail } = require("../../utils/mailer");

// run daily at 8am: remind members who haven't paid for the current cycle
cron.schedule("0 8 * * *", async () => {
  try {
    console.log("Running contribution reminder engine...");
    const groups = await Group.find({ isActive: true }).populate("members");

    for (const group of groups) {
      // determine current cycle number from rotation cycles
      const RotationCycle = require("../contributions/rotationCycleModel");
      const latest = await RotationCycle.findOne({ group: group._id }).sort({ cycleNumber: -1 });
      const cycleNumber = latest ? latest.cycleNumber : 1;

      const contributions = await Contribution.find({ group: group._id, cycleNumber }).select("user");
      const paidIds = new Set(contributions.map(c => c.user.toString()));
      const unpaidMembers = group.members.filter(m => !paidIds.has(m._id.toString()));
      const emails = unpaidMembers.map(m => m.email).filter(Boolean);
      if (emails.length) {
        await sendMail({
          to: emails.join(","),
          subject: `Reminder: please contribute to group ${group.name}`,
          text: `You have not yet made your contribution for cycle ${cycleNumber} of group ${group.name}. Please pay as soon as possible.`
        });
      }
    }
  } catch (err) {
    console.error("Reminder engine error:", err);
  }
});