/**
 * Meta Graph API helpers for Connected Accounts (Facebook + Instagram).
 * Official Graph version pinned for server-side OAuth and discovery.
 * Never log access tokens or app secrets.
 */

export const META_GRAPH_API_VERSION = "v26.0";
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
export const META_OAUTH_DIALOG_BASE = `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`;

/**
 * Initial connect scopes — strictly required for Facebook Page list +
 * Instagram professional account discovery via Facebook Login.
 * Official Meta get-started: pages_show_list + instagram_basic.
 * (`pages_read_user_content` is a Meta dependency of instagram_basic; not requested separately.)
 */
export const META_CONNECT_SCOPES = [
  "pages_show_list",
  "instagram_basic",
] as const;

/**
 * Future scopes — NOT requested at connect time. Documented for later App Review
 * after separate product approval. Do not activate here.
 */
export const META_FUTURE_SCOPES = {
  publishing: [
    "pages_manage_posts",
    "instagram_content_publish",
    "pages_read_engagement",
  ],
  advertising: ["ads_read", "ads_management"],
  leadRetrieval: ["leads_retrieval"],
  advancedAnalytics: ["instagram_manage_insights", "pages_read_user_content"],
  businessManager: ["business_management"],
} as const;

/** Allowed hosts for Meta OAuth dialog redirects (open-redirect guard). */
export const META_OAUTH_DIALOG_HOSTS = new Set([
  "www.facebook.com",
  "facebook.com",
]);

export function isMetaAuthorizeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!META_OAUTH_DIALOG_HOSTS.has(parsed.hostname)) return false;
    return parsed.pathname.includes("/dialog/oauth");
  } catch {
    return false;
  }
}

/**
 * META_REDIRECT_URI must be an absolute URL pointing at our OAuth callback.
 * Never accept a caller-supplied redirect URI.
 */
export function assertMetaRedirectUri(redirectUri: string): {
  ok: true;
} | { ok: false; code: string; message: string } {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return {
      ok: false,
      code: "META_REDIRECT_INVALID",
      message: "Meta redirect URI is not a valid absolute URL.",
    };
  }
  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    return {
      ok: false,
      code: "META_REDIRECT_INSECURE",
      message: "Meta redirect URI must use HTTPS (or localhost HTTP for development).",
    };
  }
  if (!parsed.pathname.endsWith("/api/marketing/oauth/callback")) {
    return {
      ok: false,
      code: "META_REDIRECT_PATH",
      message: "Meta redirect URI must target /api/marketing/oauth/callback.",
    };
  }
  return { ok: true };
}

export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type MetaUserProfile = {
  id: string;
  name?: string;
};

export type MetaPageAsset = {
  id: string;
  name: string;
  /** Page access token — server-only; never send to browser. */
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
  } | null;
};

export type MetaDiscoveredAssets = {
  user: MetaUserProfile;
  pages: Array<{
    id: string;
    name: string;
    tasks?: string[];
  }>;
  instagramAccounts: Array<{
    id: string;
    username?: string;
    name?: string;
    linked_page_id: string;
    linked_page_name: string;
  }>;
  /** Non-secret labels for Connected Accounts UI. */
  authorizedAssetLabels: string[];
};

export function metaAppCredentials(): {
  appId: string;
  appSecret: string;
  redirectUri: string;
} | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  if (!appId || !appSecret || !redirectUri) return null;
  const redirectCheck = assertMetaRedirectUri(redirectUri);
  if (!redirectCheck.ok) return null;
  return { appId, appSecret, redirectUri };
}

export function buildMetaAuthorizeUrl(input: {
  state: string;
  scopes?: readonly string[];
}): string {
  const creds = metaAppCredentials();
  if (!creds) {
    throw new Error("Meta OAuth credentials are not configured");
  }
  // Always use env redirect URI — never a caller-supplied value (open-redirect defense).
  const scopes = (input.scopes ?? META_CONNECT_SCOPES).join(",");
  const params = new URLSearchParams({
    client_id: creds.appId,
    redirect_uri: creds.redirectUri,
    state: input.state,
    response_type: "code",
    scope: scopes,
  });
  const url = `${META_OAUTH_DIALOG_BASE}?${params.toString()}`;
  if (!isMetaAuthorizeUrl(url)) {
    throw new Error("Refusing to build a non-Meta OAuth authorize URL");
  }
  return url;
}

export function mapMetaProviderError(raw: unknown): {
  code: string;
  message: string;
} {
  const err =
    raw && typeof raw === "object" && "error" in raw
      ? (raw as { error?: { message?: string; code?: number; type?: string } })
          .error
      : null;
  const message = err?.message || "Meta authorization failed";
  const codeNum = err?.code;
  if (codeNum === 190) {
    return {
      code: "META_TOKEN_INVALID",
      message: "Meta access expired or was revoked. Please reconnect.",
    };
  }
  if (codeNum === 10 || codeNum === 200) {
    return {
      code: "META_PERMISSION_DENIED",
      message:
        "Meta did not grant the required permissions. Reconnect and approve Page access.",
    };
  }
  if (/redirect_uri/i.test(message)) {
    return {
      code: "META_REDIRECT_MISMATCH",
      message: "Meta redirect URI does not match the configured application.",
    };
  }
  return { code: "META_API_ERROR", message: "Unable to complete Meta connection." };
}

type FetchLike = typeof fetch;

export async function metaGetJson<T>(
  url: string,
  init?: RequestInit,
  fetchImpl: FetchLike = fetch,
): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  try {
    const res = await fetchImpl(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as T & { error?: unknown };
    if (!res.ok || (json && typeof json === "object" && "error" in json && json.error)) {
      const mapped = mapMetaProviderError(json);
      return { ok: false, ...mapped };
    }
    return { ok: true, data: json as T };
  } catch {
    return {
      ok: false,
      code: "META_NETWORK_ERROR",
      message: "Unable to reach Meta. Try again later.",
    };
  }
}

export async function exchangeMetaAuthorizationCode(
  code: string,
  fetchImpl: FetchLike = fetch,
): Promise<
  | { ok: true; token: MetaTokenResponse }
  | { ok: false; code: string; message: string }
> {
  const creds = metaAppCredentials();
  if (!creds) {
    return {
      ok: false,
      code: "META_ENV_MISSING",
      message: "Meta application credentials are not configured.",
    };
  }
  const params = new URLSearchParams({
    client_id: creds.appId,
    client_secret: creds.appSecret,
    redirect_uri: creds.redirectUri,
    code,
  });
  return metaGetJson<MetaTokenResponse>(
    `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`,
    undefined,
    fetchImpl,
  ).then((r) => {
    if (!r.ok) return r;
    if (!r.data.access_token) {
      return {
        ok: false as const,
        code: "META_TOKEN_MISSING",
        message: "Meta did not return an access token.",
      };
    }
    return { ok: true as const, token: r.data };
  });
}

export async function exchangeMetaLongLivedToken(
  shortLivedToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<
  | { ok: true; token: MetaTokenResponse }
  | { ok: false; code: string; message: string }
> {
  const creds = metaAppCredentials();
  if (!creds) {
    return {
      ok: false,
      code: "META_ENV_MISSING",
      message: "Meta application credentials are not configured.",
    };
  }
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: creds.appId,
    client_secret: creds.appSecret,
    fb_exchange_token: shortLivedToken,
  });
  return metaGetJson<MetaTokenResponse>(
    `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`,
    undefined,
    fetchImpl,
  ).then((r) => {
    if (!r.ok) return r;
    if (!r.data.access_token) {
      return {
        ok: false as const,
        code: "META_TOKEN_MISSING",
        message: "Meta did not return a long-lived access token.",
      };
    }
    return { ok: true as const, token: r.data };
  });
}

export async function debugMetaToken(
  inputToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<
  | {
      ok: true;
      data: {
        app_id?: string;
        is_valid?: boolean;
        expires_at?: number;
        scopes?: string[];
        user_id?: string;
      };
    }
  | { ok: false; code: string; message: string }
> {
  const creds = metaAppCredentials();
  if (!creds) {
    return {
      ok: false,
      code: "META_ENV_MISSING",
      message: "Meta application credentials are not configured.",
    };
  }
  const appToken = `${creds.appId}|${creds.appSecret}`;
  const params = new URLSearchParams({
    input_token: inputToken,
    access_token: appToken,
  });
  const result = await metaGetJson<{
    data?: {
      app_id?: string;
      is_valid?: boolean;
      expires_at?: number;
      scopes?: string[];
      user_id?: string;
    };
  }>(`${META_GRAPH_BASE}/debug_token?${params.toString()}`, undefined, fetchImpl);
  if (!result.ok) return result;
  if (!result.data.data) {
    return {
      ok: false,
      code: "META_DEBUG_FAILED",
      message: "Unable to validate Meta access token.",
    };
  }
  return { ok: true, data: result.data.data };
}

export async function fetchMetaUserProfile(
  userToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<
  | { ok: true; user: MetaUserProfile }
  | { ok: false; code: string; message: string }
> {
  const params = new URLSearchParams({
    fields: "id,name",
    access_token: userToken,
  });
  const result = await metaGetJson<MetaUserProfile>(
    `${META_GRAPH_BASE}/me?${params.toString()}`,
    undefined,
    fetchImpl,
  );
  if (!result.ok) return result;
  if (!result.data.id) {
    return {
      ok: false,
      code: "META_USER_MISSING",
      message: "Unable to load the Meta user profile.",
    };
  }
  return { ok: true, user: result.data };
}

export async function discoverMetaBusinessAssets(
  userToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<
  | { ok: true; assets: MetaDiscoveredAssets }
  | { ok: false; code: string; message: string }
> {
  const userResult = await fetchMetaUserProfile(userToken, fetchImpl);
  if (!userResult.ok) return userResult;

  const params = new URLSearchParams({
    fields:
      "id,name,access_token,tasks,instagram_business_account{id,username,name}",
    access_token: userToken,
  });
  const pagesResult = await metaGetJson<{ data?: MetaPageAsset[] }>(
    `${META_GRAPH_BASE}/me/accounts?${params.toString()}`,
    undefined,
    fetchImpl,
  );
  if (!pagesResult.ok) return pagesResult;

  const pages = pagesResult.data.data ?? [];
  const instagramAccounts: MetaDiscoveredAssets["instagramAccounts"] = [];
  for (const page of pages) {
    const ig = page.instagram_business_account;
    if (ig?.id) {
      instagramAccounts.push({
        id: ig.id,
        username: ig.username,
        name: ig.name,
        linked_page_id: page.id,
        linked_page_name: page.name,
      });
    }
  }

  const authorizedAssetLabels = [
    ...pages.map((p) => `Page: ${p.name}`),
    ...instagramAccounts.map(
      (ig) =>
        `IG Professional: ${ig.username ? `@${ig.username}` : ig.name || ig.id}`,
    ),
  ];

  return {
    ok: true,
    assets: {
      user: userResult.user,
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        tasks: p.tasks,
      })),
      instagramAccounts,
      authorizedAssetLabels,
    },
  };
}

/** Best-effort app deauthorize. Failures are non-fatal for disconnect UX. */
export async function revokeMetaUserPermissions(
  userToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ ok: boolean }> {
  const params = new URLSearchParams({ access_token: userToken });
  try {
    const res = await fetchImpl(`${META_GRAPH_BASE}/me/permissions?${params}`, {
      method: "DELETE",
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export function expiresAtFromSeconds(
  expiresIn: number | undefined,
  nowMs = Date.now(),
): string | null {
  if (!expiresIn || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return new Date(nowMs + expiresIn * 1000).toISOString();
}
