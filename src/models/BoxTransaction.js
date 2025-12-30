const mongoose = require("mongoose");

const BoxTransactionSchema = new mongoose.Schema({
  boxId: mongoose.Schema.Types.ObjectId,
  familyId: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  type: { type: String, enum: ["in", "out"] },
  value: Number,
  date: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("BoxTransaction", BoxTransactionSchema);
