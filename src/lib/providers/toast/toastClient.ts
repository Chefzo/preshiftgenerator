import { env, hasEnv } from "@/lib/env";

/**
 * Thin Toast partner API client: machine-client OAuth + authenticated JSON GET.
 *
 * NOTE: Toast endpoint paths/shapes must be verified against current Toast
 * partner docs at integration time. This client isolates auth + transport so
 * each provider method can be validated independently against the Toast sandbox.
 */
export class ToastClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  private readonly hostname = env("TOAST_API_HOSTNAME");
  private readonly clientId = env("TOAST_CLIENT_ID");
  private readonly clientSecret = env("TOAST_CLIENT_SECRET");
  readonly restaurantGuid = env("TOAST_RESTAURANT_GUID");

  static credentialsPresent(): boolean {
    return hasEnv(
      "TOAST_API_HOSTNAME",
      "TOAST_CLIENT_ID",
      "TOAST_CLIENT_SECRET",
      "TOAST_RESTAURANT_GUID",
    );
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 60_000) return this.token;

    const res = await fetch(`${this.hostname}/authentication/v1/authentication/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        userAccessType: "TOAST_MACHINE_CLIENT",
      }),
    });
    if (!res.ok) throw new Error(`Toast auth failed: ${res.status}`);

    const data = (await res.json()) as {
      token: { accessToken: string; expiresIn: number };
    };
    this.token = data.token.accessToken;
    this.tokenExpiresAt = now + data.token.expiresIn * 1000;
    return this.token;
  }

  /** Authenticated GET against the Toast API, scoped to the configured restaurant. */
  async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const token = await this.getToken();
    const url = new URL(`${this.hostname}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Toast-Restaurant-External-ID": this.restaurantGuid,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Toast GET ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }
}
