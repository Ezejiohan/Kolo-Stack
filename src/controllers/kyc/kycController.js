const KYC = require("../../modules/kycModel");

exports.submitKYC = async (req, res) => {
  try {
    const existing = await KYC.findOne({ user: req.user._id });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "KYC already submitted"
      });
    }

    const kyc = await KYC.create({
      user: req.user._id,
      status: "approved" // ⚠️ change to "pending" in production
    });

    res.status(201).json({
      success: true,
      message: "KYC submitted successfully",
      data: kyc
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
