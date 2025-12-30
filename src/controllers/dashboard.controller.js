const Transaction = require("../models/Transaction");
const Box = require("../models/Box");

exports.getSummary = async (req, res) => {
  try {
    const familyId = req.user.familyId;

    const incomeAgg = await Transaction.aggregate([
      {
        $match: {
          familyId: familyId,
          type: "income"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$value" }
        }
      }
    ]);

    const expenseAgg = await Transaction.aggregate([
      {
        $match: {
          familyId: familyId,
          type: "expense"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$value" }
        }
      }
    ]);

    const income = incomeAgg[0]?.total || 0;
    const expense = expenseAgg[0]?.total || 0;

    const boxes = await Box.find({ familyId });

    res.json({
      income,
      expense,
      balance: income - expense,
      boxes
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar resumo do dashboard" });
  }
};