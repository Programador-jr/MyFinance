const DEFAULT_SERIES_CODE = String(process.env.BCB_CDI_SERIES_CODE || "12").trim();
const DEFAULT_TIMEOUT_MS = 7000;
const DEFAULT_CACHE_TTL_MINUTES = 180;

let cdiCache = null;
let inflightRequest = null;

function toNumber(value, fallback = 0) {
  const normalized =
    typeof value === "string"
      ? value.replace(",", ".").trim()
      : value;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function round6(value) {
  const n = toNumber(value, 0);
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

function getTimeoutMs() {
  const value = toNumber(process.env.CDI_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  return value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function getCacheTtlMs() {
  const envMinutes = toNumber(process.env.CDI_CACHE_TTL_MINUTES, DEFAULT_CACHE_TTL_MINUTES);
  const minutes = envMinutes > 0 ? envMinutes : DEFAULT_CACHE_TTL_MINUTES;
  return Math.floor(minutes * 60 * 1000);
}

function dailyPercentToAnnualPercent(dailyPercent) {
  const daily = Math.max(toNumber(dailyPercent, 0), 0);
  if (daily <= 0) return 0;

  const dailyDecimal = daily / 100;
  return round6((Math.pow(1 + dailyDecimal, 252) - 1) * 100);
}

function readCache({ allowExpired = false } = {}) {
  if (!cdiCache) return null;

  const now = Date.now();
  if (!allowExpired && cdiCache.expiresAtMs <= now) return null;

  return { ...cdiCache };
}

function writeCache(payload) {
  const now = Date.now();
  const ttlMs = getCacheTtlMs();

  cdiCache = {
    ...payload,
    cachedAtMs: now,
    expiresAtMs: now + ttlMs,
  };

  return { ...cdiCache };
}

function getFallbackAnnualRate() {
  const fallback = toNumber(process.env.CDI_ANNUAL_FALLBACK_RATE, 0);
  return fallback > 0 ? round6(fallback) : 0;
}

async function fetchLatestCdiFromBcb() {
  const seriesCode = DEFAULT_SERIES_CODE || "12";
  const timeoutMs = getTimeoutMs();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint =
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${encodeURIComponent(seriesCode)}` +
      `/dados/ultimos/1?formato=json`;

    const response = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`BCB HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!Array.isArray(json) || !json.length) {
      throw new Error("Resposta do BCB sem dados");
    }

    const latest = json[json.length - 1] || {};
    const dailyRatePercent = round6(toNumber(latest.valor, 0));
    const annualRatePercent = dailyPercentToAnnualPercent(dailyRatePercent);

    if (dailyRatePercent <= 0 || annualRatePercent <= 0) {
      throw new Error("Taxa CDI invalida recebida do BCB");
    }

    return {
      provider: "bcb_sgs",
      seriesCode,
      referenceDate: String(latest.data || "").trim() || null,
      dailyRatePercent,
      annualRatePercent,
      fetchedAt: new Date().toISOString(),
      stale: false,
      fallback: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getLatestCdiRate(options = {}) {
  const forceRefresh = !!options.forceRefresh;
  const allowStale = options.allowStale !== false;

  if (!forceRefresh) {
    const freshCache = readCache();
    if (freshCache) {
      return {
        ...freshCache,
        fromCache: true,
        stale: !!freshCache.stale,
      };
    }
  }

  if (inflightRequest && !forceRefresh) {
    return inflightRequest;
  }

  inflightRequest = (async () => {
    try {
      const latest = await fetchLatestCdiFromBcb();
      const cached = writeCache(latest);

      return {
        ...cached,
        fromCache: false,
      };
    } catch (err) {
      const staleCache = allowStale ? readCache({ allowExpired: true }) : null;
      if (staleCache) {
        return {
          ...staleCache,
          fromCache: true,
          stale: true,
          warning: "Usando CDI em cache por indisponibilidade temporaria do BCB",
        };
      }

      const fallbackAnnualRate = getFallbackAnnualRate();
      if (fallbackAnnualRate > 0) {
        return {
          provider: "fallback_env",
          seriesCode: DEFAULT_SERIES_CODE || "12",
          referenceDate: null,
          dailyRatePercent: 0,
          annualRatePercent: fallbackAnnualRate,
          fetchedAt: new Date().toISOString(),
          stale: true,
          fallback: true,
          fromCache: false,
          warning: "Usando CDI_ANNUAL_FALLBACK_RATE por indisponibilidade do BCB",
        };
      }

      throw err;
    } finally {
      inflightRequest = null;
    }
  })();

  return inflightRequest;
}

module.exports = {
  getLatestCdiRate,
};
