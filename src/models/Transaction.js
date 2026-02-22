const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  familyId: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  type: { type: String, enum: ["income", "expense"] },
  value: Number,
  category: String,
  group: { type: String, enum: ["fixed", "variable", "planned", "unexpected"] },
  date: Date,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", TransactionSchema);
