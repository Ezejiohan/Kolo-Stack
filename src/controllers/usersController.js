const User = require("../modules/userModel"); // adjust path if needed
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* =========================
   Generate JWT Token
========================= */
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* =========================
   Register User
========================= */
exports.register = async (req, res) => {
  try {
    const { fullname, email, phone, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      fullname,
      email,
      phone,
      password: hashedPassword
    });

    return res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* =========================
   Login User
========================= */
exports.login = async (req, res) => {
  try {
    /* =========================
       VALIDATE REQUEST BODY
    ========================= */
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    /* =========================
       CHECK IF USER EXISTS
    ========================= */
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    /* =========================
       VERIFY PASSWORD
    ========================= */
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    /* =========================
       GENERATE TOKEN
    ========================= */
    const token = generateToken(user._id);

    /* =========================
       SUCCESS RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token
      }
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
