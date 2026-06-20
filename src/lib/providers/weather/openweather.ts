import type { Weather } from "@/lib/types";

interface OwmResponse {
  current: {
    temp: number;
    weather: { main: string; description: string }[];
    sunset: number;
  };
  daily?: { pop: number }[];
  timezone_offset?: number;
}

/** OpenWeather One Call (imperial units). Needs OPENWEATHER_API_KEY. */
export async function getOpenWeather(
  lat: number,
  lon: number,
  apiKey: string,
): Promise<Weather> {
  const url = new URL("https://api.openweathermap.org/data/3.0/onecall");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("units", "imperial");
  url.searchParams.set("exclude", "minutely,hourly,alerts");
  url.searchParams.set("appid", apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather ${res.status}`);
  const data = (await res.json()) as OwmResponse;

  const w = data.current.weather[0];
  const pop = data.daily?.[0]?.pop ?? 0;

  return {
    tempF: Math.round(data.current.temp),
    condition: w?.main ?? "Unknown",
    precipChance: Math.round(pop * 100),
    summary: w?.description ?? "",
    alerts: [],
  };
}
