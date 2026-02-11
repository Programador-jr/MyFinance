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

function normalizeAccountType(value, fallback = "installment") {
  const raw = String(value || fallback).trim().toLowerCase();
  if (raw === "subscription") return "subscription";
  if (raw === "fixed") return "fixed";
  return "installment";
}

function normalizeBillingCycle(value, fallback = "monthly") {
  const raw = String(value || fallback).trim().toLowerCase();
  return raw === "annual" ? "annual" : "monthly";
}

function addCycle(baseDate, cycle) {
  const date = parseDate(baseDate);
  if (!date) return null;
  const copy = new Date(date);
  if (cycle === "annual") {
    copy.setFullYear(copy.getFullYear() + 1);
  } else {
    copy.setMonth(copy.getMonth() + 1);
  }
  return copy;
}

function isRecurringType(accountType) {
  return accountType === "subscription" || accountType === "fixed";
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameYearMonth(dateA, dateB) {
  if (!(dateA instanceof Date) || Number.isNaN(dateA.getTime())) return false;
  if (!(dateB instanceof Date) || Number.isNaN(dateB.getTime())) return false;
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth()
  );
}

function normalizeNote(value) {
  return String(value || "").trim();
}

function pushAdjustmentHistory(account, entry) {
  if (!entry) return;

  const changedAt = parseDate(entry.changedAt) || new Date();
  const oldValue = round2(Math.max(toNumber(entry.oldValue, 0), 0));
  const newValue = round2(Math.max(toNumber(entry.newValue, 0), 0));
  const note = normalizeNote(entry.note);

  if (newValue <= 0) return;

  const currentHistory = Array.isArray(account.adjustmentHistory)
    ? account.adjustmentHistory.map((item) => ({
      changedAt: parseDate(item.changedAt) || new Date(),
      oldValue: round2(Math.max(toNumber(item.oldValue, 0), 0)),
      newValue: round2(Math.max(toNumber(item.newValue, 0), 0)),
      note: normalizeNote(item.note)
    }))
    : [];

  currentHistory.push({
    changedAt,
    oldValue,
    newValue,
    note
  });

  // Evita crescimento indefinido do documento mantendo somente o historico mais recente.
  account.adjustmentHistory = currentHistory
    .sort((a, b) => a.changedAt - b.changedAt)
    .slice(-120);
}

function normalizePayload(body, current = null) {
  const data = body && typeof body === "object" ? body : {};

  const nameRaw = data.name ?? current?.name ?? "";
  const name = String(nameRaw).trim();
  const accountType = normalizeAccountType(data.accountType ?? current?.accountType ?? "installment");
  const recurringType = isRecurringType(accountType);
  const billingCycle = accountType === "subscription"
    ? normalizeBillingCycle(data.billingCycle ?? current?.billingCycle ?? "monthly")
    : "monthly";

  const recurringValue = round2(Math.max(
    toNumber(data.recurringValue ?? data.installmentValue ?? current?.recurringValue ?? current?.installmentValue, -1),
    -1
  ));

  let installmentValue = round2(
    Math.max(toNumber(data.installmentValue ?? current?.installmentValue, -1), -1)
  );

  let downPayment = round2(
    Math.max(toNumber(data.downPayment ?? current?.downPayment, 0), 0)
  );

  let installments = parseInstallments(
    data.installments ?? current?.installments ?? 1,
    current?.installments ?? 1
  );

  let paidInstallmentsRaw = data.paidInstallments ?? current?.paidInstallments ?? 0;
  let paidInstallments = Math.min(
    Math.max(Math.floor(toNumber(paidInstallmentsRaw, 0)), 0),
    installments
  );

  const firstDueDateRaw = data.firstDueDate ?? current?.firstDueDate;
  const firstDueDate = parseDate(firstDueDateRaw);
  const nextDueDateRaw = data.nextDueDate ?? current?.nextDueDate;
  const nextDueDate = parseDate(nextDueDateRaw) || null;
  const lastPaymentAtRaw = data.lastPaymentAt ?? current?.lastPaymentAt;
  const lastPaymentAt = parseDate(lastPaymentAtRaw) || null;
  const subscriptionPayments = Math.max(
    Math.floor(toNumber(data.subscriptionPayments ?? current?.subscriptionPayments, 0)),
    0
  );

  const categoryRaw = data.category ?? current?.category ?? "";
  const category = String(categoryRaw).trim();

  // Tipos recorrentes nao usam logica de parcelamento tradicional.
  if (recurringType) {
    installmentValue = recurringValue;
    downPayment = 0;
    installments = 1;
    paidInstallments = 0;
  }

  return {
    name,
    accountType,
    billingCycle,
    recurringValue,
    installmentValue,
    downPayment,
    installments,
    paidInstallments,
    firstDueDate,
    nextDueDate,
    lastPaymentAt,
    subscriptionPayments,
    category
  };
}

function validatePayload(payload) {
  if (!payload.name) return "Nome da conta e obrigatorio";

  if (isRecurringType(payload.accountType)) {
    if (!Number.isFinite(payload.recurringValue) || payload.recurringValue <= 0) {
      return payload.accountType === "fixed"
        ? "Valor fixo deve ser maior que zero"
        : "Valor da assinatura deve ser maior que zero";
    }
    if (payload.accountType === "subscription" && !["monthly", "annual"].includes(payload.billingCycle)) {
      return "Ciclo da assinatura invalido";
    }
    if (!payload.firstDueDate) {
      return payload.accountType === "fixed"
        ? "Proximo vencimento invalido"
        : "Data da primeira cobranca invalida";
    }
    return null;
  }

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
  const accountType = normalizeAccountType(account?.accountType, "installment");

  if (isRecurringType(accountType)) {
    return round2(Math.max(toNumber(account?.recurringValue ?? account?.installmentValue, 0), 0));
  }

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
      accountType: payload.accountType,
      billingCycle: payload.billingCycle,
      recurringValue: isRecurringType(payload.accountType) ? payload.recurringValue : 0,
      ...payload
    });

    if (isRecurringType(payload.accountType)) {
      account.nextDueDate = payload.firstDueDate;
      await account.save();
    }

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

    const previousType = normalizeAccountType(account.accountType, "installment");
    const nextType = normalizeAccountType(payload.accountType, "installment");
    const nextRecurring = isRecurringType(nextType);
    const previousRecurringValue = round2(Math.max(
      toNumber(account.recurringValue ?? account.installmentValue, 0),
      0
    ));

    account.name = payload.name;
    account.accountType = nextType;
    account.billingCycle = payload.billingCycle;
    account.recurringValue = nextRecurring ? payload.recurringValue : 0;
    account.installmentValue = payload.installmentValue;
    account.downPayment = payload.downPayment;
    account.installments = payload.installments;
    account.paidInstallments = payload.paidInstallments;
    account.firstDueDate = payload.firstDueDate;
    account.nextDueDate = nextRecurring
      ? (payload.nextDueDate || account.nextDueDate || payload.firstDueDate)
      : null;
    account.lastPaymentAt = nextRecurring
      ? (payload.lastPaymentAt || account.lastPaymentAt || null)
      : null;
    account.subscriptionPayments = nextRecurring
      ? Math.max(toNumber(account.subscriptionPayments, 0), 0)
      : 0;
    account.category = payload.category;

    if (nextType === "subscription") {
      const nextRecurringValue = round2(Math.max(toNumber(payload.recurringValue, 0), 0));
      const hasChangedValue = Math.abs(nextRecurringValue - previousRecurringValue) >= 0.01;

      if (previousType === "subscription" && hasChangedValue) {
        pushAdjustmentHistory(account, {
          changedAt: req.body?.adjustmentDate || new Date(),
          oldValue: previousRecurringValue,
          newValue: nextRecurringValue,
          note: req.body?.adjustmentNote || "Reajuste manual"
        });
      }
    }

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

    const accountType = normalizeAccountType(account.accountType, "installment");

    if (accountType === "installment" && account.paidInstallments >= account.installments) {
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

    if (isRecurringType(accountType)) {
      const lastPaymentAt = parseDate(account.lastPaymentAt);
      // Bloqueia cobranca duplicada da mesma conta recorrente no mesmo mes de referencia.
      if (lastPaymentAt && isSameYearMonth(lastPaymentAt, new Date())) {
        return res.status(400).json({ error: "Conta recorrente ja foi paga neste mes" });
      }
    }

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

    if (isRecurringType(accountType)) {
      const cycle = accountType === "fixed"
        ? "monthly"
        : normalizeBillingCycle(account.billingCycle, "monthly");
      const baseDueDate = parseDate(account.nextDueDate || account.firstDueDate) || date;

      let nextDueDate = addCycle(baseDueDate, cycle);
      // Garante vencimento sempre futuro mesmo apos pagamentos em atraso.
      if (nextDueDate && nextDueDate <= date) {
        nextDueDate = addCycle(date, cycle);
      }

      account.recurringValue = round2(Math.max(toNumber(account.recurringValue ?? account.installmentValue, 0), 0));
      account.installmentValue = account.recurringValue;
      account.downPayment = 0;
      account.installments = 1;
      account.paidInstallments = 0;
      account.subscriptionPayments = Math.max(Math.floor(toNumber(account.subscriptionPayments, 0)), 0) + 1;
      account.lastPaymentAt = date;
      account.nextDueDate = nextDueDate || account.nextDueDate || account.firstDueDate || date;
    } else {
      account.paidInstallments = Math.min(account.paidInstallments + 1, account.installments);
    }

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

exports.adjustSubscription = async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      familyId: req.familyId
    });

    if (!account) {
      return res.status(404).json({ error: "Conta nao encontrada" });
    }

    const accountType = normalizeAccountType(account.accountType, "installment");
    if (accountType !== "subscription") {
      return res.status(400).json({ error: "Apenas assinaturas podem ser reajustadas" });
    }

    const oldValue = round2(Math.max(toNumber(account.recurringValue ?? account.installmentValue, 0), 0));
    const newValue = round2(Math.max(toNumber(req.body?.newValue, -1), -1));
    if (!Number.isFinite(newValue) || newValue <= 0) {
      return res.status(400).json({ error: "Novo valor deve ser maior que zero" });
    }

    if (Math.abs(newValue - oldValue) < 0.01) {
      return res.status(400).json({ error: "Novo valor deve ser diferente do valor atual" });
    }

    const changedAt = parseDate(req.body?.changedAt || req.body?.effectiveDate || new Date());
    if (!changedAt) {
      return res.status(400).json({ error: "Data do reajuste invalida" });
    }

    pushAdjustmentHistory(account, {
      changedAt,
      oldValue,
      newValue,
      note: req.body?.note || ""
    });

    account.recurringValue = newValue;
    account.installmentValue = newValue;
    account.updatedAt = new Date();
    await account.save();

    return res.json(account);
  } catch (err) {
    console.error("ACCOUNT ADJUST SUBSCRIPTION ERROR:", err);
    return res.status(500).json({ error: "Erro ao reajustar assinatura" });
  }
};
