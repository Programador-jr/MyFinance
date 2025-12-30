const Transaction = require("../models/Transaction");

exports.create = async (req, res) => {
  const transaction = await Transaction.create({
    ...req.body,
    familyId: req.familyId,
    userId: req.userId
  });

  res.json(transaction);
};

exports.list = async (req, res) => {
  const transactions = await Transaction.find({
    familyId: req.familyId
  }).sort({ date: -1 });

  res.json(transactions);
};
