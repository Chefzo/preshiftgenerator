import type { Weather } from "@/lib/types";

/**
 * US National Weather Service — free, no API key. Two hops: resolve the gridpoint
 * for the lat/lon, then read its forecast. We surface tonight's period.
 */
const UA = "PreShiftBrief/0.1 (restaurant ops tool)";

interface NwsPointsResponse {
  properties: { forecast: string; relativeLocation?: { properties?: { city?: string } } };
}

interface NwsForecastPeriod {
  name: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  probabilityOfPrecipitation?: { value: number | null };
  shortForecast: string;
  detailedForecast: string;
}

interface NwsForecastResponse {
  properties: { periods: NwsForecastPeriod[] };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/geo+json" } });
  if (!res.ok) throw new Error(`NWS ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export async function getNwsWeather(lat: number, lon: number): Promise<Weather> {
  const points = await getJson<NwsPointsResponse>(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
  );
  const forecast = await getJson<NwsForecastResponse>(points.properties.forecast);

  const periods = forecast.properties.periods ?? [];
  // Prefer the first night-time period (tonight); fall back to the first period.
  const tonight = periods.find((p) => !p.isDaytime) ?? periods[0];
  if (!tonight) throw new Error("NWS returned no forecast periods");

  const precip = tonight.probabilityOfPrecipitation?.value ?? 0;

  return {
    tempF: tonight.temperatureUnit === "F" ? tonight.temperature : cToF(tonight.temperature),
    condition: tonight.shortForecast,
    precipChance: precip,
    summary: tonight.detailedForecast,
    alerts: [],
  };
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}
