const Transaction = require("../models/Transaction");

exports.create = async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...req.body,
      familyId: req.familyId,
      userId: req.userId
    });

    return res.json(transaction);

  } catch (err) {
    console.error("Create transaction error:", err);
    return res.status(500).json({ error: "Erro ao criar transação" });
  }
};

exports.list = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      familyId: req.familyId
    }).sort({ date: -1 });

    return res.json(transactions);

  } catch (err) {
    console.error("List transactions error:", err);
    return res.status(500).json({ error: "Erro ao listar transações" });
  }
};

exports.byMonth = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        error: "Ano e mês são obrigatórios"
      });
    }

    // Intervalo fechado do mes informado.
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59);

    const transactions = await Transaction.find({
      familyId: req.familyId,
      date: { $gte: start, $lte: end }
    }).sort({ date: -1 });

    return res.json({ transactions });

  } catch (err) {
    console.error("Transactions by month error:", err);
    return res.status(500).json({ error: "Erro ao buscar transações do mês" });
  }
};

exports.byYear = async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({
        error: "Ano é obrigatório"
      });
    }

    // Intervalo fechado do ano informado.
    const start = new Date(year, 0, 1, 0, 0, 0);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await Transaction.find({
      familyId: req.familyId,
      date: { $gte: start, $lte: end }
    }).sort({ date: -1 });

    return res.json({ transactions });

  } catch (err) {
    console.error("Transactions by year error:", err);
    return res.status(500).json({ error: "Erro ao buscar transações do ano" });
  }
};

exports.byRange = async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: "Datas inicial e final são obrigatórias"
      });
    }

    // Ajusta o fim do periodo para incluir o dia inteiro.
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const transactions = await Transaction.find({
      familyId: req.familyId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });

    return res.json({ transactions });

  } catch (err) {
    console.error("Transactions by range error:", err);
    return res.status(500).json({ error: "Erro ao buscar transações por período" });
  }
};

exports.getById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      familyId: req.familyId
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    return res.json(transaction);

  } catch (err) {
    console.error("Get transaction by id error:", err);
    return res.status(500).json({ error: "Erro ao buscar transação" });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, familyId: req.familyId },
      req.body,
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        error: "Transação não encontrada"
      });
    }

    return res.json(transaction);

  } catch (err) {
    console.error("Update transaction error:", err);
    return res.status(500).json({ error: "Erro ao atualizar transação" });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      familyId: req.familyId
    });

    if (!transaction) {
      return res.status(404).json({
        error: "Transação não encontrada"
      });
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("Delete transaction error:", err);
    return res.status(500).json({ error: "Erro ao excluir transação" });
  }
};
