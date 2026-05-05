import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getLatestWeight,
  getWeightHistory,
  LibraApiError,
  WeightEntry,
} from "./libraApi";

const TOKEN_STORAGE_KEY = "libra.accessToken";
const HISTORY_RANGES = [
  { id: "31d", label: "31 dagar", days: 31 },
  { id: "90d", label: "90 dagar", days: 90 },
  { id: "1y", label: "1 år", days: 365 },
  { id: "all", label: "All historik", from: new Date("2000-01-01T00:00:00.000Z") },
] as const;

type HistoryRangeId = (typeof HISTORY_RANGES)[number]["id"];
const LIMITED_HISTORY_WINDOW_DAYS = 45;

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; latest: WeightEntry; history: WeightEntry[] }
  | { status: "error"; message: string; isAuthError: boolean };

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function removeStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function getHistoryRangeOption(rangeId: HistoryRangeId) {
  return HISTORY_RANGES.find((range) => range.id === rangeId) ?? HISTORY_RANGES[0];
}

function getHistoryRange(rangeId: HistoryRangeId) {
  const to = new Date();
  const option = getHistoryRangeOption(rangeId);

  if ("from" in option) {
    return { from: option.from, to };
  }

  const from = new Date(to);
  from.setDate(from.getDate() - (option.days - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function looksLikeLimitedHistory(rangeId: HistoryRangeId, entries: WeightEntry[]) {
  if (rangeId === "31d" || entries.length === 0) {
    return false;
  }

  const oldestEntryTime = new Date(entries[0].date).getTime();
  const limitedWindowStart = new Date();
  limitedWindowStart.setDate(limitedWindowStart.getDate() - LIMITED_HISTORY_WINDOW_DAYS);

  return oldestEntryTime > limitedWindowStart.getTime();
}

export default function App() {
  const [token, setToken] = useState(getStoredToken);
  const [tokenInput, setTokenInput] = useState(token);
  const [historyRange, setHistoryRange] = useState<HistoryRangeId>("31d");
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!token) {
      setLoadState({ status: "idle" });
      return;
    }

    const controller = new AbortController();

    async function loadWeights() {
      setLoadState({ status: "loading" });
      try {
        const range = getHistoryRange(historyRange);
        const [latest, history] = await Promise.all([
          getLatestWeight(token, controller.signal),
          getWeightHistory(token, range, controller.signal),
        ]);
        setLoadState({ status: "loaded", latest, history });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof LibraApiError) {
          setLoadState({
            status: "error",
            message: error.message,
            isAuthError: error.status === 401,
          });
          return;
        }

        setLoadState({
          status: "error",
          message: "Kunde inte hämta data från Libra.",
          isAuthError: false,
        });
      }
    }

    void loadWeights();

    return () => controller.abort();
  }, [token, historyRange]);

  function handleSaveToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) {
      return;
    }
    storeToken(nextToken);
    setToken(nextToken);
  }

  function handleClearToken() {
    removeStoredToken();
    setToken("");
    setTokenInput("");
    setLoadState({ status: "idle" });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Webfront till Libra</p>
          <h1>Viktöversikt</h1>
          <p className="intro">
            En lokal tokenbaserad vy för{" "}
            <a href="https://libra-app.eu/" target="_blank" rel="noreferrer">
              Libra Weight Loss app
            </a>
            .
          </p>
        </div>
        <TokenForm
          tokenInput={tokenInput}
          hasToken={Boolean(token)}
          onTokenInputChange={setTokenInput}
          onSaveToken={handleSaveToken}
          onClearToken={handleClearToken}
        />
      </header>

      {loadState.status === "idle" && (
        <section className="empty-state">
          <h2>Klistra in din Libra-token</h2>
          <p>Tokenen sparas lokalt i den här browsern.</p>
        </section>
      )}

      {loadState.status === "loading" && (
        <section className="status-panel" aria-live="polite">
          Hämtar viktdata...
        </section>
      )}

      {loadState.status === "error" && (
        <section className="status-panel error" role="alert">
          <h2>{loadState.isAuthError ? "Ogiltig token" : "Något gick fel"}</h2>
          <p>{loadState.message}</p>
        </section>
      )}

      {loadState.status === "loaded" && (
        <Dashboard
          latest={loadState.latest}
          history={loadState.history}
          historyRange={historyRange}
          onHistoryRangeChange={setHistoryRange}
        />
      )}
    </main>
  );
}

type TokenFormProps = {
  tokenInput: string;
  hasToken: boolean;
  onTokenInputChange: (value: string) => void;
  onSaveToken: (event: FormEvent<HTMLFormElement>) => void;
  onClearToken: () => void;
};

function TokenForm({
  tokenInput,
  hasToken,
  onTokenInputChange,
  onSaveToken,
  onClearToken,
}: TokenFormProps) {
  return (
    <form className="token-form" onSubmit={onSaveToken}>
      <label htmlFor="token">Token</label>
      <div className="token-row">
        <input
          id="token"
          type="password"
          value={tokenInput}
          placeholder="Libra access token"
          autoComplete="off"
          onChange={(event) => onTokenInputChange(event.target.value)}
        />
        <button type="submit">Spara</button>
        {hasToken && (
          <button className="secondary" type="button" onClick={onClearToken}>
            Rensa
          </button>
        )}
      </div>
    </form>
  );
}

function Dashboard({
  latest,
  history,
  historyRange,
  onHistoryRangeChange,
}: {
  latest: WeightEntry;
  history: WeightEntry[];
  historyRange: HistoryRangeId;
  onHistoryRangeChange: (range: HistoryRangeId) => void;
}) {
  const summary = useMemo(() => getSummary(history), [history]);
  const selectedRange = getHistoryRangeOption(historyRange);
  const showLimitedHistoryNotice = looksLikeLimitedHistory(historyRange, history);

  return (
    <div className="dashboard">
      <section className="metrics-grid" aria-label="Sammanfattning">
        <MetricCard
          label="Senaste vikt"
          value={`${formatNumber(latest.weight)} kg`}
          detail={formatDateTime(latest.date)}
        />
        <MetricCard
          label="Trend"
          value={`${formatNumber(latest.weight_trend)} kg`}
          detail="Libra trendvikt"
        />
        <MetricCard
          label={selectedRange.label}
          value={summary.deltaText}
          detail={`${history.length} mätningar`}
          tone={summary.deltaTone}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Historik</p>
            <h2>{selectedRange.id === "all" ? "All historik" : `Senaste ${selectedRange.label}`}</h2>
          </div>
          <label className="range-control">
            <span>Intervall</span>
            <select
              value={historyRange}
              onChange={(event) => onHistoryRangeChange(event.target.value as HistoryRangeId)}
            >
              {HISTORY_RANGES.map((range) => (
                <option key={range.id} value={range.id}>
                  {range.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {history.length === 0 ? (
          <p className="muted">Inga mätningar hittades för perioden.</p>
        ) : (
          <>
            {showLimitedHistoryNotice && (
              <div className="notice" role="status">
                Libra API:t returnerade bara data från {formatShortDate(history[0].date)} och framåt för det här intervallet.
                Om du har äldre mätningar i Libra kan tokenen eller API-accessen vara begränsad till senaste 31 dagarna.
              </div>
            )}
            <WeightChart entries={history} />
            <WeightTable entries={history} />
          </>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const points = entries.map((entry) => ({
    date: entry.date,
    weight: entry.weight,
    trend: entry.weight_trend,
  }));

  if (points.length < 2) {
    return (
      <div className="chart-placeholder">
        Minst två mätningar behövs för en graf.
      </div>
    );
  }

  const values = points.flatMap((point) => [point.weight, point.trend]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.18, 0.4);
  const domainMin = min - padding;
  const domainMax = max + padding;
  const width = 960;
  const height = 320;
  const left = 54;
  const right = 24;
  const top = 24;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  function x(index: number) {
    return left + (plotWidth * index) / (points.length - 1);
  }

  function y(value: number) {
    return top + plotHeight - ((value - domainMin) / (domainMax - domainMin)) * plotHeight;
  }

  const weightPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.weight)}`)
    .join(" ");
  const trendPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.trend)}`)
    .join(" ");
  const ticks = [domainMin, (domainMin + domainMax) / 2, domainMax];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Vikt och trend">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="axis-label" x={12} y={y(tick) + 5}>
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <path className="weight-line" d={weightPath} />
        <path className="trend-line" d={trendPath} />
        {points.map((point, index) => (
          <circle
            key={`${point.date}-${point.weight}`}
            className="weight-dot"
            cx={x(index)}
            cy={y(point.weight)}
            r="4"
          />
        ))}
        <text className="date-label" x={left} y={height - 12}>
          {formatShortDate(points[0].date)}
        </text>
        <text className="date-label end" x={width - right} y={height - 12}>
          {formatShortDate(points[points.length - 1].date)}
        </text>
      </svg>
      <div className="legend">
        <span><i className="legend-weight" /> Vikt</span>
        <span><i className="legend-trend" /> Trend</span>
      </div>
    </div>
  );
}

function WeightTable({ entries }: { entries: WeightEntry[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Vikt</th>
            <th>Trend</th>
            <th>Logg</th>
          </tr>
        </thead>
        <tbody>
          {[...entries].reverse().map((entry) => (
            <tr key={`${entry.date}-${entry.weight}`}>
              <td>{formatDateTime(entry.date)}</td>
              <td>{formatNumber(entry.weight)} kg</td>
              <td>{formatNumber(entry.weight_trend)} kg</td>
              <td>{entry.log || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getSummary(entries: WeightEntry[]) {
  if (entries.length < 2) {
    return { deltaText: "-", deltaTone: "neutral" as const };
  }

  const first = entries[0].weight_trend;
  const last = entries[entries.length - 1].weight_trend;
  const delta = last - first;
  const sign = delta > 0 ? "+" : "";

  return {
    deltaText: `${sign}${formatNumber(delta)} kg`,
    deltaTone: delta > 0 ? ("up" as const) : delta < 0 ? ("down" as const) : ("neutral" as const),
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
