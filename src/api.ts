export type CardCreate = {
  sport?: string | null;
  year?: number | null;
  brand?: string | null;
  set_name?: string | null;
  player?: string | null;
  team?: string | null;
  card_number?: string | null;
  parallel?: string | null;
  condition?: string | null;
  grader?: string | null;
  grade?: string | null;
  notes?: string | null;
  image_front_path?: string | null;
  image_cropped_path?: string | null;
  ocr_text?: string | null;
  confidence?: number | null;
  listing_url?: string | null;
  listing_title?: string | null;
};

export type MatchCandidate = {
  checklist_id: number;
  score: number;
  year?: number | null;
  brand?: string | null;
  set_name?: string | null;
  player?: string | null;
  card_number?: string | null;
  parallel?: string | null;
};

export type ScanResult = {
  extracted: CardCreate;
  candidates: MatchCandidate[];
};

export type CardOut = CardCreate & { id: number };

const key = "cardtrack_backend_url";

export function getBackendUrl(): string {
  return localStorage.getItem(key) || "";
}

export function setBackendUrl(url: string) {
  localStorage.setItem(key, url.replace(/\/+$/, ""));
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function scanCard(file: File, backendUrl: string): Promise<ScanResult> {
  const fd = new FormData();
  fd.append("image", file);
  return req<ScanResult>(`${backendUrl}/scan`, { method: "POST", body: fd });
}

export async function uploadImage(file: File, backendUrl: string): Promise<{image_front_path: string; image_cropped_path: string;}> {
  const fd = new FormData();
  fd.append("image", file);
  return req(`${backendUrl}/upload-image`, { method: "POST", body: fd });
}

export async function createCard(payload: CardCreate, backendUrl: string): Promise<CardOut> {
  return req<CardOut>(`${backendUrl}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listCards(backendUrl: string): Promise<CardOut[]> {
  return req<CardOut[]>(`${backendUrl}/cards`);
}

export async function deleteCard(cardId: number, backendUrl: string): Promise<{ok: boolean}> {
  return req(`${backendUrl}/cards/${cardId}`, { method: "DELETE" });
}

export function imageUrl(relPath: string, backendUrl: string): string {
  // backend serves /images/{relPath}, where relPath is relative to backend/data
  return `${backendUrl}/images/${relPath}`;
}


export async function health(backendUrl: string): Promise<{ok: boolean}> {
  return req(`${backendUrl}/health`);
}
