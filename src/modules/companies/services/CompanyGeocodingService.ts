import { AppError } from "../../../core/errors/AppError.js";

export interface CompanyGeocodingResult {
  latitude: string;
  longitude: string;
  displayName: string;
  provider: "OpenStreetMap Nominatim";
}

interface NominatimResult {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
}

interface CompanyAddress {
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
}

export class CompanyGeocodingService {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly minimumIntervalMs: number;
  private readonly userAgent: string;
  private readonly cache = new Map<string, CompanyGeocodingResult>();
  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  public constructor(params?: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
    minimumIntervalMs?: number;
    userAgent?: string;
  }) {
    this.endpoint = params?.endpoint || process.env.GEOCODING_BASE_URL?.trim() || "https://nominatim.openstreetmap.org/search";
    this.fetchImpl = params?.fetchImpl ?? fetch;
    this.minimumIntervalMs = params?.minimumIntervalMs ?? 1_000;
    this.userAgent = params?.userAgent || process.env.GEOCODING_USER_AGENT?.trim() || "Birgus/0.1";
  }

  public async geocode(params: CompanyAddress): Promise<CompanyGeocodingResult> {
    const query = [params.address, params.postalCode, params.city, params.province, params.country]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", ");

    if (!params.address.trim() || !params.city.trim()) {
      throw new AppError("Indirizzo e citta sono necessari per cercare la posizione.", "COMPANY_ADDRESS_INCOMPLETE", 400);
    }

    const cacheKey = query.toLocaleLowerCase("it-IT");
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const request = this.queue.then(() => this.requestPosition(params, query));
    this.queue = request.then(() => undefined, () => undefined);
    const result = await request;
    this.cache.set(cacheKey, result);
    return result;
  }

  private async requestPosition(params: CompanyAddress, query: string): Promise<CompanyGeocodingResult> {
    const attempts = [
      this.buildFreeFormUrl(query),
      this.buildStructuredUrl(params),
      this.buildFreeFormUrl([params.address, params.city, params.country].map((value) => value.trim()).filter(Boolean).join(", ")),
    ];

    for (const url of new Map(attempts.map((attempt) => [attempt.toString(), attempt])).values()) {
      const result = await this.requestNominatim(url);
      if (result) return result;
    }

    throw new AppError(
      "Nessuna posizione trovata. Controlla indirizzo, numero civico e citta; CAP e provincia possono essere omessi se non riconosciuti.",
      "COMPANY_ADDRESS_NOT_FOUND",
      422,
    );
  }

  private buildStructuredUrl(params: CompanyAddress): URL {
    const url = this.buildBaseUrl();
    url.searchParams.set("street", params.address.trim());
    url.searchParams.set("city", params.city.trim());
    if (params.postalCode.trim()) url.searchParams.set("postalcode", params.postalCode.trim());
    if (params.country.trim()) url.searchParams.set("country", params.country.trim());
    return url;
  }

  private buildFreeFormUrl(query: string): URL {
    const url = this.buildBaseUrl();
    url.searchParams.set("q", query);
    return url;
  }

  private buildBaseUrl(): URL {
    const url = new URL(this.endpoint);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    return url;
  }

  private async requestNominatim(url: URL): Promise<CompanyGeocodingResult | null> {
    const waitMs = Math.max(0, this.lastRequestAt + this.minimumIntervalMs - Date.now());
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestAt = Date.now();

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "it",
          "User-Agent": this.userAgent,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AppError("Il servizio di geocodifica non e raggiungibile.", "GEOCODING_UNAVAILABLE", 503);
    }

    if (!response.ok) {
      throw new AppError(
        `Il servizio di geocodifica ha rifiutato la richiesta (HTTP ${response.status}).`,
        "GEOCODING_REQUEST_FAILED",
        502,
      );
    }

    let payload: NominatimResult[];
    try {
      payload = await response.json() as NominatimResult[];
    } catch {
      throw new AppError("Il servizio di geocodifica ha restituito una risposta non valida.", "GEOCODING_RESPONSE_INVALID", 502);
    }

    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first) return null;

    const latitude = typeof first?.lat === "string" ? Number(first.lat) : Number.NaN;
    const longitude = typeof first?.lon === "string" ? Number(first.lon) : Number.NaN;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError("Il servizio di geocodifica ha restituito coordinate non valide.", "GEOCODING_RESPONSE_INVALID", 502);
    }

    return {
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
      displayName: typeof first?.display_name === "string" ? first.display_name : url.searchParams.get("q") ?? paramsToDisplayName(url),
      provider: "OpenStreetMap Nominatim",
    };
  }
}

function paramsToDisplayName(url: URL): string {
  return [url.searchParams.get("street"), url.searchParams.get("postalcode"), url.searchParams.get("city"), url.searchParams.get("country")]
    .filter(Boolean)
    .join(", ");
}
