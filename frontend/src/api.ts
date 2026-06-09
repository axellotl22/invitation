export class ApiError extends Error {
  /** i18n key, e.g. "errors.pin.invalid" */
  readonly key: string;
  readonly status: number;

  constructor(key: string, status: number) {
    super(key);
    this.key = key;
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; householdToken?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.householdToken) headers['x-household-token'] = options.householdToken;

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('errors.network', 0);
  }

  if (!response.ok) {
    if (response.status === 429) throw new ApiError('errors.rateLimited', 429);
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(data?.error ?? 'errors.server', response.status);
  }
  return response.json() as Promise<T>;
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  let response: Response;
  try {
    response = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'include' });
  } catch {
    throw new ApiError('errors.network', 0);
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(data?.error ?? 'errors.server', response.status);
  }
  return response.json() as Promise<{ url: string }>;
}
