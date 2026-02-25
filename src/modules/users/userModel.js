const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        fullname: {
            type: String,
            required: [true, "Fullname is required"],
            trim: true
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true
        },

        phone: {
            type: String,
            required: [true, "Phone number is required"],
            unique: true,
            trim: true
        },

        password: {
            type: String,
            required: [true, "Password is required"]
        },
        role: {
            type: String,
            enum: ["user", "admin", "super_admin"],
            default: "user"
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        twoFactorSecret: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
