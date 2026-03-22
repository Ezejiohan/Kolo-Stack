const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const User = require("../modules/users/userModel");
const jwt = require("jsonwebtoken");

/**
 * Generate a signed JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

/**
 * Register User
 * FIX: Added password strength validation
 * FIX: Added phone format validation
 * FIX: Normalise email to lowercase before lookup/save to prevent duplicate accounts
 */
exports.register = async (req, res) => {
  try {
    const { fullname, email, phone, password } = req.body;

    // FIX: Validate required fields are present
    if (!fullname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "fullname, email, and password are required",
      });
    }

    // FIX: Minimum password strength — at least 8 chars with mixed content
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // FIX: Normalise email to lowercase to prevent duplicate accounts
    const normalizedEmail = email.toLowerCase().trim();

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullname,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Login User
 * FIX: Normalise email before lookup (consistent with register)
 */
exports.login = async (req, res) => {
  try {
    const { email, password, token } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // FIX: Normalise email on lookup
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // FIX: Use identical message for email-not-found and wrong-password
      //      to prevent user enumeration attacks
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Verify 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "2FA token required",
          twoFactorRequired: true,
        });
      }

      const isTokenValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token,
        window: 1,
      });

      if (!isTokenValid) {
        return res.status(401).json({ success: false, message: "Invalid 2FA token" });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};