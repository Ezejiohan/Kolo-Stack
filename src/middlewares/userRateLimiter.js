const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

exports.userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,

  keyGenerator: (req) => {
    // If user is logged in → limit by user ID
    if (req.user && req.user._id) {
      return req.user._id.toString();
    }

    // If not logged in → limit by IP (IPv6 safe)
    return ipKeyGenerator(req);
  },

  standardHeaders: true,
  legacyHeaders: false,
});
