const mongoose = require("mongoose");

const BoxTransactionSchema = new mongoose.Schema({
  boxId: mongoose.Schema.Types.ObjectId,
  familyId: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  type: { type: String, enum: ["in", "out", "yield"] },
  value: Number,
  grossValue: { type: Number, default: null },
  netValue: { type: Number, default: null },
  irRate: { type: Number, default: null },
  irTax: { type: Number, default: null },
  date: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("BoxTransaction", BoxTransactionSchema);
