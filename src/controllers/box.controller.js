const connectDB = require("../config/database");

const Box = require("../models/Box");
const BoxTransaction = require("../models/BoxTransaction");
const { getLatestCdiRate } = require("../services/cdi.service");

const ALLOWED_INVESTMENT_TYPES = new Set(["none", "cdb_cdi"]);

const IOF_TABLE = {
  1: 0.96,
  2: 0.93,
  3: 0.90,
  4: 0.86,
  5: 0.83,
  6: 0.80,
  7: 0.76,
  8: 0.73,
  9: 0.70,
  10: 0.66,
  11: 0.63,
  12: 0.60,
  13: 0.56,
  14: 0.53,
  15: 0.50,
  16: 0.46,
  17: 0.43,
  18: 0.40,
  19: 0.36,
  20: 0.33,
  21: 0.30,
  22: 0.26,
  23: 0.23,
  24: 0.20,
  25: 0.16,
  26: 0.13,
  27: 0.10,
  28: 0.06,
  29: 0.03,
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  const n = toNumber(value, 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "off", "nao", "não"].includes(normalized)) return false;
  if (["true", "1", "yes", "on", "sim"].includes(normalized)) return true;
  return defaultValue;
}

function startOfDay(dateLike) {
  const d = new Date(dateLike);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateInput(value) {
  if (value === undefined || value === null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function businessDaysBetween(startDate, endDate) {
  let start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (end <= start) return 0;

  let count = 0;
  start.setDate(start.getDate() + 1);

  while (start <= end) {
    const day = start.getDay();
    if (day !== 0 && day !== 6) count += 1;
    start.setDate(start.getDate() + 1);
  }

  return count;
}

function calcCalendarDaysSince(dateLike, refDate = new Date()) {
  if (!dateLike) return 0;
  const start = startOfDay(dateLike);
  const end = startOfDay(refDate);

  if (end < start) return 0;

  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function getIofRate(holdingDays) {
  if (holdingDays >= 30) return 0;
  if (holdingDays <= 0) return 0;
  return IOF_TABLE[holdingDays] || 0;
}

function getIrRate(holdingDays) {
  if (holdingDays <= 180) return 0.225;
  if (holdingDays <= 360) return 0.20;
  if (holdingDays <= 720) return 0.175;
  return 0.15;
}

function annualToDailyRate(annualRatePercent) {
  const annual = Math.max(toNumber(annualRatePercent, 0), 0);
  if (annual <= 0) return 0;
  return Math.pow(1 + annual / 100, 1 / 252) - 1;
}

function dailyToAnnualPercent(dailyRate) {
  const d = Math.max(toNumber(dailyRate, 0), 0);
  if (d <= 0) return 0;
  return round2((Math.pow(1 + d, 252) - 1) * 100);
}

function mapLegacyInvestmentType(type) {
  const value = String(type || "").trim().toLowerCase();
  if (!value || value === "none") return "none";
  if (value === "cdb_cdi") return "cdb_cdi";
  if (value === "cdi") return "cdb_cdi";
  if (value === "fixed" || value === "selic" || value === "ipca" || value === "custom") {
    return "cdb_cdi";
  }
  return "none";
}

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === "function") return value.toObject();
  if (typeof value === "object") return value;
  return {};
}

function normalizeInvestment(raw = {}, current = null) {
  const source = {
    ...toPlainObject(current),
    ...toPlainObject(raw),
  };

  const mappedType = mapLegacyInvestmentType(source.investmentType);
  let investmentType = ALLOWED_INVESTMENT_TYPES.has(mappedType) ? mappedType : "none";
  const autoCdi = parseBoolean(source.autoCdi, true);

  const hasCdiSignal =
    parseBoolean(source.autoCdi, false) ||
    toNumber(source.cdiAnnualRate ?? source.benchmarkAnnualRate, 0) > 0 ||
    toNumber(source.cdiPercentage ?? source.yieldPercentage, 0) > 0 ||
    toNumber(source.yieldMonthlyRate, 0) > 0 ||
    toNumber(source.fixedAnnualRate, 0) > 0;

  if (investmentType === "none" && hasCdiSignal) {
    investmentType = "cdb_cdi";
  }

  let cdiPercentage = Math.max(
    round2(toNumber(source.cdiPercentage ?? source.yieldPercentage, 100)),
    0
  );

  if (cdiPercentage <= 0) cdiPercentage = 100;

  let cdiAnnualRate = Math.max(
    round2(toNumber(source.cdiAnnualRate ?? source.benchmarkAnnualRate, 0)),
    0
  );

  if (cdiAnnualRate <= 0) {
    const monthlyFromLegacy = Math.max(round2(toNumber(source.yieldMonthlyRate, 0)), 0);
    if (monthlyFromLegacy > 0) {
      const annualFromMonthly = dailyToAnnualPercent(Math.pow(1 + monthlyFromLegacy / 100, 1 / 21) - 1);
      cdiAnnualRate = round2(annualFromMonthly / (cdiPercentage / 100));
    }
  }

  if (investmentType === "none") {
    return {
      investmentType: "none",
      cdiAnnualRate: 0,
      cdiPercentage: 0,
      autoCdi: false,
    };
  }

  return {
    investmentType: "cdb_cdi",
    cdiAnnualRate,
    cdiPercentage,
    autoCdi,
  };
}

function validateInvestment(investment) {
  if (investment.investmentType === "none") return null;

  if (!investment.cdiPercentage || investment.cdiPercentage <= 0) {
    return "Informe o percentual do CDI";
  }

  if (!investment.autoCdi && (!investment.cdiAnnualRate || investment.cdiAnnualRate <= 0)) {
    return "Informe a taxa CDI anual (%) ou ative o CDI automatico";
  }

  return null;
}

async function resolveMarketCdiAnnualRate(options = {}) {
  const forceRefresh = !!options.forceRefresh;
  const allowStale = options.allowStale !== false;

  try {
    const market = await getLatestCdiRate({ forceRefresh, allowStale });
    const annualRate = Math.max(round2(toNumber(market?.annualRatePercent, 0)), 0);

    return {
      annualRate,
      market,
      error: null,
    };
  } catch (err) {
    return {
      annualRate: 0,
      market: null,
      error: err,
    };
  }
}

async function applyMarketCdiToInvestment(investment, options = {}) {
  if (investment.investmentType !== "cdb_cdi" || !investment.autoCdi) {
    return { market: null };
  }

  const presetRate = Math.max(round2(toNumber(options.marketCdiAnnualRate, 0)), 0);
  if (presetRate > 0) {
    investment.cdiAnnualRate = presetRate;
    return { market: null };
  }

  const { annualRate, market, error } = await resolveMarketCdiAnnualRate({
    forceRefresh: !!options.forceRefresh,
    allowStale: options.allowStale !== false,
  });

  if (annualRate > 0) {
    investment.cdiAnnualRate = annualRate;
    return { market };
  }

  if (options.strict && (!investment.cdiAnnualRate || investment.cdiAnnualRate <= 0)) {
    const cause = error?.message ? ` (${error.message})` : "";
    throw new Error(`Nao foi possivel obter o CDI oficial${cause}`);
  }

  return { market: null };
}

function getEffectiveAnnualRate(boxLike) {
  const investment = normalizeInvestment(boxLike, boxLike);
  if (investment.investmentType === "none") return 0;
  return round2(investment.cdiAnnualRate * (investment.cdiPercentage / 100));
}

function buildTaxProjection(currentValue, principalValue, holdingDays) {
  const current = Math.max(round2(toNumber(currentValue, 0)), 0);
  const principal = Math.max(round2(toNumber(principalValue, 0)), 0);
  const grossProfit = Math.max(round2(current - principal), 0);

  const iofRate = getIofRate(holdingDays);
  const irRate = getIrRate(holdingDays);

  const iofTax = round2(grossProfit * iofRate);
  const profitAfterIof = Math.max(round2(grossProfit - iofTax), 0);
  const irTax = round2(profitAfterIof * irRate);
  const totalTax = round2(iofTax + irTax);

  const netCurrentValue = round2(current - totalTax);
  const netProfit = Math.max(round2(netCurrentValue - principal), 0);

  return {
    principalValue: principal,
    grossProfit,
    netProfit,
    netCurrentValue,
    tax: {
      iofRate,
      irRate,
      iofTax,
      irTax,
      totalTax,
    },
  };
}

function serializeBox(boxDoc) {
  const raw = typeof boxDoc.toObject === "function" ? boxDoc.toObject() : boxDoc;
  const investment = normalizeInvestment(raw, raw);

  const currentValue = Math.max(round2(toNumber(raw.currentValue, 0)), 0);
  const principalValue = Math.max(round2(toNumber(raw.principalValue, 0)), 0);

  const effectiveAnnualRate = getEffectiveAnnualRate(investment);
  const dailyRate = annualToDailyRate(effectiveAnnualRate);

  const holdingDays = calcCalendarDaysSince(raw.firstContributionAt || raw.createdAt || new Date());
  const taxes = buildTaxProjection(currentValue, principalValue, holdingDays);

  const estimatedDailyGrossYield = round2(currentValue * dailyRate);
  const estimatedDailyIofTax = round2(estimatedDailyGrossYield * taxes.tax.iofRate);
  const dailyAfterIof = round2(estimatedDailyGrossYield - estimatedDailyIofTax);
  const estimatedDailyIrTax = round2(dailyAfterIof * taxes.tax.irRate);
  const estimatedDailyNetYield = round2(dailyAfterIof - estimatedDailyIrTax);

  const displayName =
    investment.investmentType === "cdb_cdi"
      ? `CDB (${investment.cdiPercentage.toFixed(2)}% do CDI)`
      : "Sem rendimento";

  return {
    ...raw,
    currentValue,
    principalValue,
    investmentType: investment.investmentType,
    autoCdi: !!investment.autoCdi,
    cdiAnnualRate: round2(investment.cdiAnnualRate),
    cdiPercentage: round2(investment.cdiPercentage),
    effectiveAnnualRate: round2(effectiveAnnualRate),
    effectiveDailyRate: dailyRate,
    investmentDisplayName: displayName,
    holdingDays,
    estimatedDailyGrossYield,
    estimatedDailyNetYield,
    dailyGrossYield: estimatedDailyGrossYield,
    dailyLiquidity: estimatedDailyNetYield,
    ...taxes,
  };
}

async function applyAutomaticYield(box, req, options = {}) {
  const investment = normalizeInvestment(box, box);

  box.investmentType = investment.investmentType;
  box.autoCdi = !!investment.autoCdi;
  box.cdiAnnualRate = investment.cdiAnnualRate;
  box.cdiPercentage = investment.cdiPercentage;

  if (investment.investmentType === "cdb_cdi" && investment.autoCdi && !options.disableMarketFetch) {
    try {
      await applyMarketCdiToInvestment(investment, {
        marketCdiAnnualRate: options.marketCdiAnnualRate,
        allowStale: true,
      });
      box.cdiAnnualRate = investment.cdiAnnualRate;
    } catch (err) {
      // Se falhar consulta do CDI oficial, continua com a taxa atual registrada.
    }
  }

  const currentValue = Math.max(round2(toNumber(box.currentValue, 0)), 0);
  const principalValue = Math.max(round2(toNumber(box.principalValue, 0)), 0);

  // Legacy migration: old boxes had no principal tracking.
  if (currentValue > 0 && principalValue <= 0 && !box.firstContributionAt) {
    box.principalValue = currentValue;
    box.firstContributionAt = box.createdAt || new Date();
  }

  if (!box.lastYieldAppliedAt) {
    box.lastYieldAppliedAt = new Date();
  }

  if (investment.investmentType === "none") {
    if (box.isModified()) {
      await box.save();
    }
    return;
  }

  if (!investment.cdiAnnualRate || investment.cdiAnnualRate <= 0) {
    if (box.isModified()) {
      await box.save();
    }
    return;
  }

  const now = new Date();
  const lastAppliedAt = box.lastYieldAppliedAt ? new Date(box.lastYieldAppliedAt) : new Date(box.createdAt || now);
  const businessDays = businessDaysBetween(lastAppliedAt, now);

  if (businessDays <= 0) {
    if (box.isModified()) {
      await box.save();
    }
    return;
  }

  const effectiveAnnualRate = getEffectiveAnnualRate(investment);
  const dailyRate = annualToDailyRate(effectiveAnnualRate);

  if (dailyRate <= 0) {
    box.lastYieldAppliedAt = now;
    box.updatedAt = now;
    await box.save();
    return;
  }

  const baseValue = Math.max(toNumber(box.currentValue, 0), 0);
  const growthFactor = Math.pow(1 + dailyRate, businessDays) - 1;
  const yieldValue = round2(baseValue * growthFactor);

  box.lastYieldAppliedAt = now;
  box.updatedAt = now;

  if (yieldValue > 0) {
    box.currentValue = round2(baseValue + yieldValue);
  }

  await box.save();

  if (yieldValue > 0) {
    await BoxTransaction.create({
      boxId: box._id,
      familyId: req.familyId,
      userId: req.userId,
      type: "yield",
      value: yieldValue,
      date: now,
    });
  }
}

exports.list = async (req, res) => {
  try {
    await connectDB();

    const boxes = await Box.find({ familyId: req.familyId });
    const hasAutoCdiBoxes = boxes.some((box) => {
      const investment = normalizeInvestment(box, box);
      return investment.investmentType === "cdb_cdi" && investment.autoCdi;
    });

    let marketCdiAnnualRate = 0;
    let disableMarketFetch = false;
    if (hasAutoCdiBoxes) {
      const market = await resolveMarketCdiAnnualRate({ allowStale: true });
      marketCdiAnnualRate = market.annualRate > 0 ? market.annualRate : 0;
      disableMarketFetch = marketCdiAnnualRate <= 0;
    }

    for (const box of boxes) {
      await applyAutomaticYield(box, req, { marketCdiAnnualRate, disableMarketFetch });
    }

    return res.json(boxes.map((box) => serializeBox(box)));
  } catch (err) {
    console.error("BOX LIST ERROR:", err);
    return res.status(500).json({ error: "Erro ao listar caixinhas" });
  }
};

exports.move = async (req, res) => {
  try {
    await connectDB();

    const value = Math.max(round2(toNumber(req.body?.value, 0)), 0);
    const type = String(req.body?.type || "").trim().toLowerCase();

    if (!value) {
      return res.status(400).json({ error: "Valor deve ser maior que zero" });
    }

    if (type !== "in" && type !== "out") {
      return res.status(400).json({ error: "Tipo de movimentacao invalido" });
    }

    const box = await Box.findOne({
      _id: req.params.id,
      familyId: req.familyId,
    });

    if (!box) {
      return res.status(404).json({ error: "Caixinha nao encontrada" });
    }

    await applyAutomaticYield(box, req);

    const beforeValue = Math.max(round2(toNumber(box.currentValue, 0)), 0);
    const beforePrincipal = Math.max(round2(toNumber(box.principalValue, 0)), 0);

    if (type === "out" && beforeValue < value) {
      return res.status(400).json({ error: "Saldo insuficiente na caixinha" });
    }

    if (type === "in") {
      box.currentValue = round2(beforeValue + value);
      box.principalValue = round2(beforePrincipal + value);

      if (!box.firstContributionAt) {
        box.firstContributionAt = new Date();
      }
    } else {
      box.currentValue = round2(beforeValue - value);

      const proportionalPrincipalReduction = beforeValue > 0
        ? round2(beforePrincipal * (value / beforeValue))
        : 0;

      box.principalValue = Math.max(round2(beforePrincipal - proportionalPrincipalReduction), 0);

      if (box.currentValue <= 0) {
        box.currentValue = 0;
        box.principalValue = 0;
      }
    }

    box.updatedAt = new Date();
    await box.save();

    await BoxTransaction.create({
      boxId: box._id,
      familyId: req.familyId,
      userId: req.userId,
      type,
      value,
      date: new Date(),
    });

    return res.json(serializeBox(box));
  } catch (err) {
    console.error("BOX MOVE ERROR:", err);
    return res.status(500).json({ error: "Erro ao movimentar caixinha" });
  }
};

exports.create = async (req, res) => {
  try {
    await connectDB();

    const name = String(req.body?.name || "").trim();
    const isEmergency = !!req.body?.isEmergency;
    const investment = normalizeInvestment(req.body);
    const initialValue = Math.max(round2(toNumber(req.body?.initialValue, 0)), 0);
    const providedApplicationDate = parseDateInput(req.body?.applicationDate);

    if (!name) {
      return res.status(400).json({ error: "Nome e obrigatorio" });
    }

    if (req.body?.applicationDate && !providedApplicationDate) {
      return res.status(400).json({ error: "Data da aplicacao invalida" });
    }

    const today = startOfDay(new Date());
    if (providedApplicationDate && providedApplicationDate > today) {
      return res.status(400).json({ error: "Data da aplicacao nao pode ser futura" });
    }

    try {
      await applyMarketCdiToInvestment(investment, {
        strict: true,
        allowStale: true,
      });
    } catch (err) {
      return res.status(503).json({
        error: "Nao foi possivel carregar o CDI oficial no momento. Tente novamente.",
      });
    }

    const investmentError = validateInvestment(investment);
    if (investmentError) {
      return res.status(400).json({ error: investmentError });
    }

    const now = new Date();
    const firstContributionAt =
      initialValue > 0 ? (providedApplicationDate || startOfDay(now)) : null;

    const box = await Box.create({
      familyId: req.familyId,
      name,
      isEmergency,
      currentValue: initialValue,
      principalValue: initialValue,
      firstContributionAt,
      investmentType: investment.investmentType,
      autoCdi: !!investment.autoCdi,
      cdiAnnualRate: investment.cdiAnnualRate,
      cdiPercentage: investment.cdiPercentage,
      lastYieldAppliedAt: firstContributionAt || now,
      updatedAt: now,
    });

    if (initialValue > 0) {
      await BoxTransaction.create({
        boxId: box._id,
        familyId: req.familyId,
        userId: req.userId,
        type: "in",
        value: initialValue,
        date: firstContributionAt || now,
      });

      await applyAutomaticYield(box, req, {
        marketCdiAnnualRate: investment.cdiAnnualRate,
      });
    }

    return res.status(201).json(serializeBox(box));
  } catch (err) {
    console.error("BOX CREATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao criar caixinha" });
  }
};

exports.update = async (req, res) => {
  try {
    await connectDB();

    const box = await Box.findOne({
      _id: req.params.id,
      familyId: req.familyId,
    });

    if (!box) {
      return res.status(404).json({ error: "Caixinha nao encontrada" });
    }

    await applyAutomaticYield(box, req);

    const name = String(req.body?.name || "").trim();
    const isEmergency = !!req.body?.isEmergency;
    const investment = normalizeInvestment(req.body, box);

    if (!name) {
      return res.status(400).json({ error: "Nome e obrigatorio" });
    }

    try {
      await applyMarketCdiToInvestment(investment, {
        strict: false,
        allowStale: true,
      });
    } catch (err) {
      return res.status(503).json({
        error: "Nao foi possivel atualizar o CDI oficial no momento. Tente novamente.",
      });
    }

    const investmentError = validateInvestment(investment);
    if (investmentError) {
      return res.status(400).json({ error: investmentError });
    }

    const prevType = String(box.investmentType || "none");
    const prevAutoCdi = !!box.autoCdi;
    const prevCdiAnnual = round2(toNumber(box.cdiAnnualRate, 0));
    const prevPct = round2(toNumber(box.cdiPercentage, 0));

    box.name = name;
    box.isEmergency = isEmergency;
    box.investmentType = investment.investmentType;
    box.autoCdi = !!investment.autoCdi;
    box.cdiAnnualRate = investment.cdiAnnualRate;
    box.cdiPercentage = investment.cdiPercentage;
    box.updatedAt = new Date();

    if (
      prevType !== investment.investmentType ||
      prevAutoCdi !== !!investment.autoCdi ||
      prevCdiAnnual !== investment.cdiAnnualRate ||
      prevPct !== investment.cdiPercentage
    ) {
      box.lastYieldAppliedAt = new Date();
    }

    await box.save();
    return res.json(serializeBox(box));
  } catch (err) {
    console.error("BOX UPDATE ERROR:", err);
    return res.status(500).json({ error: "Erro ao atualizar caixinha" });
  }
};

exports.marketCdi = async (req, res) => {
  try {
    await connectDB();

    const forceRefresh = parseBoolean(req.query?.refresh, false);
    const market = await getLatestCdiRate({
      forceRefresh,
      allowStale: true,
    });

    return res.json({
      provider: market.provider || "bcb_sgs",
      seriesCode: market.seriesCode || String(process.env.BCB_CDI_SERIES_CODE || "12"),
      referenceDate: market.referenceDate || null,
      dailyRatePercent: round2(toNumber(market.dailyRatePercent, 0)),
      annualRatePercent: round2(toNumber(market.annualRatePercent, 0)),
      fetchedAt: market.fetchedAt || new Date().toISOString(),
      stale: !!market.stale,
      fallback: !!market.fallback,
      fromCache: !!market.fromCache,
      warning: market.warning || null,
    });
  } catch (err) {
    console.error("BOX MARKET CDI ERROR:", err);
    return res.status(503).json({
      error: "Nao foi possivel carregar o CDI oficial",
    });
  }
};

exports.remove = async (req, res) => {
  try {
    await connectDB();

    const box = await Box.findOneAndDelete({
      _id: req.params.id,
      familyId: req.familyId,
    });

    if (!box) {
      return res.status(404).json({ error: "Caixinha nao encontrada" });
    }

    await BoxTransaction.deleteMany({
      boxId: box._id,
      familyId: req.familyId,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("BOX REMOVE ERROR:", err);
    return res.status(500).json({ error: "Erro ao remover caixinha" });
  }
};
