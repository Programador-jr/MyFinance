const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    trim: true,
    required: true 
  },
  email: { 
    type: String,
    unique: true 
  },

    password: String,

  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Family"
  },
  familyRole: {
    type: String,
    enum: ["owner", "admin", "member"],
    default: "member"
  },

  avatarUrl: { 
    type: String, 
    default: null 
  },

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailVerificationToken: String,
  emailVerificationExpires: Date,

  resetPasswordToken: String,
  resetPasswordExpires: Date,

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
