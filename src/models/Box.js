const mongoose = require("mongoose");

const BoxSchema = new mongoose.Schema({
  familyId: mongoose.Schema.Types.ObjectId,
  name: String,
  currentValue: { type: Number, default: 0 },
  isEmergency: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Box", BoxSchema);
