const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,

  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Family"
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
