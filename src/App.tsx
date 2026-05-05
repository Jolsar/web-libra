import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getLatestWeight,
  getWeightHistory,
  LibraApiError,
  WeightEntry,
} from "./libraApi";

const TOKEN_STORAGE_KEY = "libra.accessToken";
const HISTORY_DAYS = 31;

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

function getDefaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (HISTORY_DAYS - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export default function App() {
  const [token, setToken] = useState(getStoredToken);
  const [tokenInput, setTokenInput] = useState(token);
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
        const range = getDefaultRange();
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
  }, [token]);

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
          <p className="eyebrow">Libra</p>
          <h1>Viktöversikt</h1>
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
        <Dashboard latest={loadState.latest} history={loadState.history} />
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
}: {
  latest: WeightEntry;
  history: WeightEntry[];
}) {
  const summary = useMemo(() => getSummary(history), [history]);

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
          label={`${HISTORY_DAYS} dagar`}
          value={summary.deltaText}
          detail={`${history.length} mätningar`}
          tone={summary.deltaTone}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Historik</p>
            <h2>Senaste {HISTORY_DAYS} dagarna</h2>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="muted">Inga mätningar hittades för perioden.</p>
        ) : (
          <>
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
