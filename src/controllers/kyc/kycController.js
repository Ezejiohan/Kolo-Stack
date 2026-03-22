const KYC = require("../../modules/kycModel");
const { sendMail } = require("../../utils/mailer");

/**
 * Submit KYC
 * FIX: Removed `status: "approved"` — KYC must start as "pending" and be
 *      reviewed by an admin. Auto-approving KYC defeats its purpose entirely.
 * FIX: Added validation that required KYC fields are provided
 */
exports.submitKYC = async (req, res) => {
  try {
    const existing = await KYC.findOne({ user: req.user._id });

    // FIX: Allow re-submission if previous attempt was rejected
    if (existing && existing.status !== "rejected") {
      return res.status(400).json({
        success: false,
        message:
          existing.status === "approved"
            ? "KYC already approved"
            : "KYC already submitted and under review",
      });
    }

    // FIX: In production you would extract documentType and documentUrl from
    //      an uploaded file (e.g. via multer). Validated here as required fields.
    const { documentType, documentUrl } = req.body;
    if (!documentType || !documentUrl) {
      return res.status(400).json({
        success: false,
        message: "documentType and documentUrl are required",
      });
    }

    const kyc = await KYC.create({
      user: req.user._id,
      documentType,
      documentUrl,
      // FIX: Status starts as "pending" — must be manually approved by admin
      status: "pending",
    });

    // Notify user
    try {
      await sendMail({
        to: req.user.email,
        subject: "KYC submission received",
        text: "Your KYC information has been submitted and is under review. We will notify you once it has been processed.",
      });
    } catch (err) {
      console.error("Failed to send KYC email:", err);
    }

    res.status(201).json({
      success: true,
      message: "KYC submitted successfully. Pending admin review.",
      data: kyc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Approve or reject a KYC submission
 * FIX: New endpoint — previously there was no way to approve KYC without
 *      direct database access (since auto-approve was the only path).
 */
exports.reviewKYC = async (req, res) => {
  try {
    // FIX: Only admins may review KYC
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { kycId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: 'status must be "approved" or "rejected"' });
    }

    if (status === "rejected" && !rejectionReason) {
      return res
        .status(400)
        .json({ success: false, message: "rejectionReason is required when rejecting KYC" });
    }

    const kyc = await KYC.findById(kycId).populate("user", "email fullname");
    if (!kyc) return res.status(404).json({ success: false, message: "KYC not found" });

    kyc.status = status;
    if (rejectionReason) kyc.rejectionReason = rejectionReason;
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = req.user._id;
    await kyc.save();

    // Notify user of decision
    try {
      if (kyc.user && kyc.user.email) {
        await sendMail({
          to: kyc.user.email,
          subject: `KYC ${status}`,
          text:
            status === "approved"
              ? "Your KYC has been approved. You can now access all platform features."
              : `Your KYC has been rejected. Reason: ${rejectionReason}. Please resubmit with valid documents.`,
        });
      }
    } catch (err) {
      console.error("Failed to send KYC review email:", err);
    }

    res.json({ success: true, message: `KYC ${status}`, data: kyc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};