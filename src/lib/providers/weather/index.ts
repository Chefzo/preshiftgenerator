import type { Weather } from "@/lib/types";
import { env, envNumber } from "@/lib/env";
import { getNwsWeather } from "./nws";
import { getOpenWeather } from "./openweather";

/**
 * Fetch tonight's weather from the configured provider. Weather is non-critical
 * to the brief, so any failure degrades gracefully to a neutral placeholder
 * rather than sinking the whole pipeline.
 */
export async function getWeather(): Promise<Weather> {
  const lat = envNumber("WEATHER_LAT", 40.7128);
  const lon = envNumber("WEATHER_LON", -74.006);
  const provider = env("WEATHER_PROVIDER", "nws").toLowerCase();

  try {
    if (provider === "openweather") {
      const key = env("OPENWEATHER_API_KEY");
      if (!key) throw new Error("OPENWEATHER_API_KEY not set");
      return await getOpenWeather(lat, lon, key);
    }
    return await getNwsWeather(lat, lon);
  } catch (err) {
    console.warn(`[weather] falling back to placeholder: ${(err as Error).message}`);
    return {
      tempF: 0,
      condition: "Unavailable",
      precipChance: 0,
      summary: "Weather data unavailable — check the window.",
      alerts: [],
    };
  }
}
