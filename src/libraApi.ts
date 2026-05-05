const API_BASE_URL = "https://api.libra-app.eu";

export type WeightEntry = {
  date: string;
  weight: number;
  weight_trend: number;
  body_fat: number | null;
  body_fat_trend: number | null;
  muscle_mass: number | null;
  muscle_mass_trend: number | null;
  log: string | null;
};

type WeightHistoryResponse = {
  values: WeightEntry[];
};

export class LibraApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LibraApiError";
  }
}

export async function getLatestWeight(
  token: string,
  signal?: AbortSignal,
): Promise<WeightEntry> {
  return request<WeightEntry>("/values/weight/latest", token, signal);
}

export async function getWeightHistory(
  token: string,
  range: { from: Date; to: Date },
  signal?: AbortSignal,
): Promise<WeightEntry[]> {
  const params = new URLSearchParams({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });
  const response = await request<WeightHistoryResponse>(
    `/values/weight?${params.toString()}`,
    token,
    signal,
  );
  return [...response.values].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

async function request<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      throw new LibraApiError("Libra did not accept this token.", 401);
    }
    throw new LibraApiError(
      text || `Libra responded with status ${response.status}.`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new LibraApiError("Libra returned a response that could not be read.");
  }
}
