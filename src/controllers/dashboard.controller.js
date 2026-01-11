const Transaction = require("../models/Transaction");
const Box = require("../models/Box");

exports.summary = async (req, res) => {
  let { year, month } = req.query;

  const now = new Date();

  year = year ? Number(year) : now.getFullYear();
  month = month ? Number(month) : now.getMonth() + 1;

  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59);

  const transactions = await Transaction.find({
    familyId: req.familyId,
    date: { $gte: start, $lte: end }
  });

  let income = 0;
  let expense = 0;

  transactions.forEach(t => {
    const value = Number(t.value) || 0;
    if (t.type === "income") income += value;
    if (t.type === "expense") expense += value;
  });

  const boxes = await Box.find({ familyId: req.familyId });

  res.json({
    income,
    expense,
    balance: income - expense,
    boxes
  });
};
