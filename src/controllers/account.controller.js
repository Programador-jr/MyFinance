const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  const n = toNumber(value, 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseInstallments(value, fallback = 1) {
  const n = Math.floor(toNumber(value, fallback));
  return Math.max(1, n);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePayload(body, current = null) {
  const data = body && typeof body === "object" ? body : {};

  const nameRaw = data.name ?? current?.name ?? "";
  const name = String(nameRaw).trim();

  const installmentValue = round2(
    Math.max(toNumber(data.installmentValue ?? current?.installmentValue, -1), -1)
  );

  const downPayment = round2(
    Math.max(toNumber(data.downPayment ?? current?.downPayment, 0), 0)
  );

  const installments = parseInstallments(
    data.installments ?? current?.installments ?? 1,
    current?.installments ?? 1
  );

  const paidInstallmentsRaw = data.paidInstallments ?? current?.paidInstallments ?? 0;
  const paidInstallments = Math.min(
    Math.max(Math.floor(toNumber(paidInstallmentsRaw, 0)), 0),
    installments
  );

  const firstDueDateRaw = data.firstDueDate ?? current?.firstDueDate;
  const firstDueDate = parseDate(firstDueDateRaw);

  const categoryRaw = data.category ?? current?.category ?? "";
  const category = String(categoryRaw).trim();

  return {
    name,
    installmentValue,
    downPayment,
    installments,
    paidInstallments,
    firstDueDate,
    category
  };
}

function validatePayload(payload) {
  if (!payload.name) return "Nome da conta e obrigatorio";
  if (!Number.isFinite(payload.installmentValue) || payload.installmentValue <= 0) {
    return "Valor da parcela deve ser maior que zero";
  }
  if (!Number.isFinite(payload.downPayment) || payload.downPayment < 0) {
    return "Entrada deve ser zero ou maior";
  }
  if (!Number.isFinite(payload.installments) || payload.installments < 1) {
    return "Parcelas deve ser no minimo 1";
  }
  if (!payload.firstDueDate) return "Data do primeiro vencimento invalida";
  return null;
}

function resolveNextPaymentValue(account) {
  const installments = parseInstallments(account.installments, 1);
  const paidInstallments = Math.min(
    Math.max(Math.floor(toNumber(account.paidInstallments, 0)), 0),
    installments
  );
  const installmentValue = round2(Math.max(toNumber(account.installmentValue, 0), 0));

  const financedTotal = round2(installmentValue * installments);
  const paidAmount = round2(installmentValue * paidInstallments);
  const remainingInstallments = Math.max(installments - paidInstallments, 0);
  const remainingAmount = round2(Math.max(financedTotal - paidAmount, 0));

  return remainingInstallments <= 1 ? remainingAmount : installmentValue;
}

exports.create = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const error = validatePayload(payload);

    if (error) {
      return res.status(400).json({ error });
    }

    const account = await Account.create({
      familyId: req.familyId,
      userId: req.userId,
      ...payload
    });

    return res.status(201).json(account);
  } catch (err) {
    console.error("ACCOUNT CREATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao criar conta" });
  }
};

exports.list = async (req, res) => {
  try {
    const accounts = await Account.find({
      familyId: req.familyId
    }).sort({ createdAt: -1 });

    return res.json(accounts);
  } catch (err) {
    console.error("ACCOUNT LIST ERROR:", err);
    return res.status(500).json({ error: "Erro ao listar contas" });
  }
};

exports.getById = async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      familyId: req.familyId
    });

    if (!account) {
      return res.status(404).json({ error: "Conta nao encontrada" });
    }

    return res.json(account);
  } catch (err) {
    console.error("ACCOUNT GET ERROR:", err);
    return res.status(500).json({ error: "Erro ao buscar conta" });
  }
};

exports.update = async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      familyId: req.familyId
    });

    if (!account) {
      return res.status(404).json({ error: "Conta nao encontrada" });
    }

    const payload = normalizePayload(req.body, account);
    const error = validatePayload(payload);

    if (error) {
      return res.status(400).json({ error });
    }

    account.name = payload.name;
    account.installmentValue = payload.installmentValue;
    account.downPayment = payload.downPayment;
    account.installments = payload.installments;
    account.paidInstallments = payload.paidInstallments;
    account.firstDueDate = payload.firstDueDate;
    account.category = payload.category;
    account.updatedAt = new Date();

    await account.save();
    return res.json(account);
  } catch (err) {
    console.error("ACCOUNT UPDATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao atualizar conta" });
  }
};

exports.remove = async (req, res) => {
  try {
    const account = await Account.findOneAndDelete({
      _id: req.params.id,
      familyId: req.familyId
    });

    if (!account) {
      return res.status(404).json({ error: "Conta nao encontrada" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("ACCOUNT DELETE ERROR:", err);
    return res.status(500).json({ error: "Erro ao excluir conta" });
  }
};

exports.pay = async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      familyId: req.familyId
    });

    if (!account) {
      return res.status(404).json({ error: "Conta nao encontrada" });
    }

    if (account.paidInstallments >= account.installments) {
      return res.status(400).json({ error: "Conta ja esta concluida" });
    }

    const categoryFromBody = String(req.body?.category || "").trim();
    const category = account.category || categoryFromBody;

    if (!category) {
      return res.status(400).json({ error: "Categoria e obrigatoria no primeiro pagamento" });
    }

    const paymentValue = resolveNextPaymentValue(account);
    if (paymentValue <= 0) {
      return res.status(400).json({ error: "Valor de pagamento invalido" });
    }

    const paymentDate = req.body?.date ? parseDate(req.body.date) : new Date();
    const date = paymentDate || new Date();

    const transaction = await Transaction.create({
      familyId: req.familyId,
      userId: req.userId,
      type: "expense",
      value: paymentValue,
      category,
      group: "fixed",
      date
    });

    account.category = category;
    account.paidInstallments = Math.min(account.paidInstallments + 1, account.installments);
    account.updatedAt = new Date();
    await account.save();

    return res.json({
      account,
      transaction,
      paymentValue
    });
  } catch (err) {
    console.error("ACCOUNT PAY ERROR:", err);
    return res.status(500).json({ error: "Erro ao registrar pagamento da conta" });
  }
};
