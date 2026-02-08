const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema({
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Family",
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  installmentValue: {
    type: Number,
    required: true,
    min: 0.01
  },
  downPayment: {
    type: Number,
    default: 0,
    min: 0
  },
  installments: {
    type: Number,
    required: true,
    min: 1
  },
  paidInstallments: {
    type: Number,
    default: 0,
    min: 0
  },
  firstDueDate: {
    type: Date,
    required: true
  },
  category: {
    type: String,
    trim: true,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

AccountSchema.index({ familyId: 1, createdAt: -1 });

module.exports = mongoose.model("Account", AccountSchema);
