const mongoose = require("mongoose");

const FamilySchema = new mongoose.Schema({
  name: { 
    type: String,
    required: true },

  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  inviteCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Family", FamilySchema);
