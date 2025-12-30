const mongoose = require("mongoose");

const FamilySchema = new mongoose.Schema({
  name: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Family", FamilySchema);
