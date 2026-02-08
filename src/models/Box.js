const mongoose = require("mongoose");

const BoxSchema = new mongoose.Schema({
  familyId: mongoose.Schema.Types.ObjectId,
  name: { type: String, trim: true },
  currentValue: { type: Number, default: 0 },
  principalValue: { type: Number, default: 0 },
  firstContributionAt: { type: Date, default: null },
  isEmergency: { type: Boolean, default: false },
  investmentType: {
    type: String,
    enum: ["none", "cdb_cdi"],
    default: "none"
  },
  autoCdi: { type: Boolean, default: false },
  cdiAnnualRate: { type: Number, default: 0 },
  cdiPercentage: { type: Number, default: 0 },
  // Legacy fields kept for backward-compatibility in old documents/payloads.
  investmentLabel: { type: String, default: "", trim: true },
  yieldMonthlyRate: { type: Number, default: 0 },
  benchmarkAnnualRate: { type: Number, default: 0 },
  yieldPercentage: { type: Number, default: 0 },
  fixedAnnualRate: { type: Number, default: 0 },
  lastYieldAppliedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Box", BoxSchema);
