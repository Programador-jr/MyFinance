const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  type: {
    type: String,
    enum: ["income", "expense"],
    required: true
  },

  isFixed: {
    type: Boolean,
    default: false
  },

  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Family",
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Category", CategorySchema);
