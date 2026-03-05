const KYC = require("../modules/kycModel");

const requireKyc = async (req, res, next) => {
  try {
    console.log("Logged in user:", req.user._id);
    
    const kyc = await KYC.findOne({
      user: req.user._id,
      status: "approved"
    });

    console.log("KYC found:", kyc);

    if (!kyc) {
      return res.status(403).json({
        success: false,
        message: "KYC verification required"
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = requireKyc;
