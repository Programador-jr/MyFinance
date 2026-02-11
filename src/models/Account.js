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
  accountType: {
    type: String,
    enum: ["installment", "subscription", "fixed"],
    default: "installment"
  },
  billingCycle: {
    type: String,
    enum: ["monthly", "annual"],
    default: "monthly"
  },
  recurringValue: {
    type: Number,
    default: 0,
    min: 0
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
  nextDueDate: {
    type: Date,
    default: null
  },
  lastPaymentAt: {
    type: Date,
    default: null
  },
  subscriptionPayments: {
    type: Number,
    default: 0,
    min: 0
  },
  adjustmentHistory: [{
    changedAt: {
      type: Date,
      required: true
    },
    oldValue: {
      type: Number,
      required: true,
      min: 0
    },
    newValue: {
      type: Number,
      required: true,
      min: 0
    },
    note: {
      type: String,
      trim: true,
      default: ""
    }
  }],
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
