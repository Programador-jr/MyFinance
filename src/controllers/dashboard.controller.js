const Transaction = require("../models/Transaction");
const Box = require("../models/Box");

exports.summary = async (req, res) => {
  const familyId = req.user.familyId;

  const transactions = await Transaction.find({ familyId });

  let income = 0;
  let expense = 0;

  transactions.forEach(t => {
    if (t.type === "income") income += t.value;
    else if (t.type === "expense") expense += t.value;
  });

  const boxes = await Box.find({ familyId });

  res.json({
    income,
    expense,
    balance: income - expense,
    boxes
  });
};