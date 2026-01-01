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

exports.byMonth = async (req, res) => {
  let { year, month } = req.query;

  year = Number(year);
  month = Number(month);

  if (!year || !month) {
    return res.status(400).json({ error: "Ano e mês inválidos" });
  }

  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59);

  const transactions = await Transaction.find({
    familyId: req.familyId,
    date: { $gte: start, $lte: end }
  }).sort({ date: -1 });

  let income = 0;
  let expense = 0;

  transactions.forEach(t => {
    const value = Number(t.value) || 0;

    if (t.type === "income") income += value;
    if (t.type === "expense") expense += value;
  });

  res.json({
    income,
    expense,
    balance: income - expense,
    transactions
  });
};

/* =====================
   EDITAR TRANSAÇÃO
===================== */
exports.update = async (req, res) => {
  const { id } = req.params;

  const transaction = await Transaction.findOneAndUpdate(
    { _id: id, familyId: req.familyId },
    req.body,
    { new: true }
  );

  if (!transaction) {
    return res.status(404).json({ error: "Transação não encontrada" });
  }

  res.json(transaction);
};

/* =====================
   EXCLUIR TRANSAÇÃO
===================== */
exports.remove = async (req, res) => {
  const { id } = req.params;

  const transaction = await Transaction.findOneAndDelete({
    _id: id,
    familyId: req.familyId
  });

  if (!transaction) {
    return res.status(404).json({ error: "Transação não encontrada" });
  }

  res.json({ success: true });
};


/* ===============================
   CRIAR TRANSAÇÃO
================================ */

exports.create = async (req, res) => {
  const transaction = await Transaction.create({
    ...req.body,
    familyId: req.familyId,
    userId: req.userId
  });

  res.json(transaction);
};

/* ===============================
   LISTAR TODAS
================================ */

exports.list = async (req, res) => {
  const transactions = await Transaction.find({
    familyId: req.familyId
  }).sort({ date: -1 });

  res.json(transactions);
};

/* ===============================
   POR MÊS
================================ */

exports.byMonth = async (req, res) => {
  const { year, month } = req.query;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const transactions = await Transaction.find({
    familyId: req.familyId,
    date: { $gte: start, $lte: end }
  }).sort({ date: -1 });

  res.json({
    transactions
  });
};

/* ===============================
   POR ANO
================================ */

exports.byYear = async (req, res) => {
  const { year } = req.query;

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);

  const transactions = await Transaction.find({
    familyId: req.familyId,
    date: { $gte: start, $lte: end }
  }).sort({ date: -1 });

  res.json({
    transactions
  });
};

/* ===============================
   INTERVALO PERSONALIZADO
================================ */

exports.byRange = async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({
      error: "Datas inicial e final são obrigatórias"
    });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  const transactions = await Transaction.find({
    familyId: req.familyId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });

  res.json({
    transactions
  });
};