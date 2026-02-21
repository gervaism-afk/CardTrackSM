import React, { useEffect, useMemo, useState } from "react";
import CameraCapture from "./CameraCapture";
import BackendPrompt from "./BackendPrompt";
import QrScan from "./QrScan";
import {
  CardCreate,
  CardOut,
  ScanResult,
  createCard,
  deleteCard,
  getBackendUrl,
  imageUrl,
  listCards,
  scanCard,
  setBackendUrl,
  uploadImage,
  health,
} from "./api"
import { ocrExtract } from "./ocr"
import { parseFromListingTitle, buildEbaySearchQuery } from "./smartMatch";
import ShadowFoxLogo from "./assets/shadowfox-logo.png";

type Tab = "scan" | "collection" | "settings";

function fileFromBlob(blob: Blob, name: string) {
  return new File([blob], name, { type: "image/jpeg" });



}

export default function App() {
  
  React.useEffect(() => { document.title = "ShadowFox SC – CardTrack MVP"; }, []);
const [tab, setTab] = useState<Tab>("scan");
  const [backendUrl, setBackend] = useState<string>(getBackendUrl() || "");
  const [backendModalOpen, setBackendModalOpen] = useState<boolean>(!getBackendUrl());
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState<boolean>(false);
  const [pcQrUrl, setPcQrUrl] = useState<string>("");

  const [busy, setBusy] = useState(false);

  const [lastCapture, setLastCapture] = useState<File | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [imgPaths, setImgPaths] = useState<{image_front_path: string; image_cropped_path: string;} | null>(null);

  const [draft, setDraft] = useState<CardCreate>({});

  const [smartUrl, setSmartUrl] = useState<string>("");
  const [smartMatchStatus, setSmartMatchStatus] = useState<string>("");
  const [cards, setCards] = useState<CardOut[]>([]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => {
      const hay = [
        c.player, c.brand, c.set_name, c.card_number, c.parallel, c.sport, String(c.year ?? ""),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [cards, query]);

  const refreshCards = async () => {
    if (!backendUrl) return;
    const rows = await listCards(backendUrl);
    setCards(rows);
  };

const validateBackend = async (url: string) => {
  if (!url) {
    setBackendStatus("Backend URL not set.");
    setBackendModalOpen(true);
    return false;
  }
  try {
    await health(url);
    setBackendStatus(null);
    return true;
  } catch {
    setBackendStatus("Can’t reach your backend. Make sure ShadowFox SC – CardTrack MVP Backend is running on your Windows PC and your phone is on the same Wi‑Fi.");
    setBackendModalOpen(true);
    return false;
  }
};


const tryHealth = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${url}/health`, { signal: controller.signal });
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({}));
    return !!(j as any)?.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
};

const discoverBackend = async (): Promise<string | null> => {
  // Browser/PWA can’t do UDP/mDNS discovery reliably, so we do a fast HTTP subnet scan.
  const candidates: string[] = [];
  const ports = ["8000"];
  const prefixes = ["192.168.0.", "192.168.1.", "192.168.2.", "10.0.0.", "10.0.1.", "10.1.1."];

  const last = localStorage.getItem("cardtrack_last_host");
  if (last) candidates.push(last);

  const likelyHosts = [2, 10, 20, 25, 50, 75, 100, 150, 200, 250];
  for (const pref of prefixes) {
    for (const h of likelyHosts) {
      for (const port of ports) candidates.push(`http://${pref}${h}:${port}`);
    }
  }

  // Broader scan (kept short so it feels instant)
  for (const pref of ["192.168.0.", "192.168.1.", "10.0.0."]) {
    for (let h = 2; h <= 80; h++) {
      for (const port of ports) candidates.push(`http://${pref}${h}:${port}`);
    }
  }

  const seen = new Set<string>();
  const urls = candidates.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));

  const concurrency = 20;
  let i = 0;

  const workers = new Array(concurrency).fill(0).map(async () => {
    while (i < urls.length) {
      const url = urls[i++];
      const ok = await tryHealth(url, 450);
      if (ok) return url;
    }
    return null;
  });

  const results = await Promise.all(workers);
  const found = results.find((x) => x);
  if (found) {
    localStorage.setItem("cardtrack_last_host", found);
    return found;
  }
  return null;
};

const loadPcQr = async (url: string) => {
  try {
    // Backend serves QR at /qr
    setPcQrUrl(`${url}/qr`);
  } catch {
    setPcQrUrl("");
  }
};


useEffect(() => {
  // On app start or when backend changes, validate.
  if (!backendUrl) {
    setBackendModalOpen(true);
    return;
  }
  validateBackend(backendUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [backendUrl]);



  useEffect(() => {
    if (backendUrl) refreshCards().catch(() => {});
  }, [backendUrl]);

  const onCapture = async (blob: Blob) => {
    const ok = await validateBackend(backendUrl);
    if (!ok) return;
    const file = fileFromBlob(blob, `card_${Date.now()}.jpg`);
    const ocr = await ocrExtract(file);
    setLastCapture(file);
    setBusy(true);
    try {
      const paths = await uploadImage(file, backendUrl);
      setImgPaths(paths);

      const res = await scanCard(file, backendUrl);
      setScan(res);
      setDraft({
        ...(ocr||{}),
        ...res.extracted,
        image_front_path: paths.image_front_path,
        image_cropped_path: paths.image_cropped_path,
      });
    } catch (e: any) {
      alert(e?.message || "Scan failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveCard = async () => {
    if (!backendUrl) return;
    setBusy(true);
    try {
      await createCard(draft, backendUrl);
      setScan(null);
      setLastCapture(null);
      setImgPaths(null);
      setDraft({
        ...(ocr||{}),});
      await refreshCards();
      setTab("collection");
    } catch (e: any) {
      alert(e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeCard = async (id: number) => {
    if (!backendUrl) return;
    if (!confirm("Delete this card from your collection?")) return;
    setBusy(true);
    try {
      await deleteCard(id, backendUrl);
      await refreshCards();
    } catch (e: any) {
      alert(e?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const applyCandidate = (idx: number) => {
    if (!scan) return;
    const c = scan.candidates[idx];
    setDraft((d) => ({
      ...d,
      year: c.year ?? d.year ?? null,
      brand: c.brand ?? d.brand ?? null,
      set_name: c.set_name ?? d.set_name ?? null,
      player: c.player ?? d.player ?? null,
      card_number: c.card_number ?? d.card_number ?? null,
      parallel: c.parallel ?? d.parallel ?? null,
    }));
  };

  async function smartMatchFromUrl() {
    try {
      if (!smartUrl.trim()) return;
      setSmartMatchStatus("Matching…");

      const r = await fetch("/api/parse-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: smartUrl.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();

      const parsed = parseFromListingTitle(String(data.title || ""), draft?.ocr_text || "");
      setDraft((prev: any) => ({ ...(prev || {}), ...parsed, listing_url: smartUrl.trim(), listing_title: String(data.title || "") }));
      setSmartMatchStatus("Matched! Please verify fields.");
    } catch (e: any) {
      setSmartMatchStatus(e?.message || String(e));
    }
  }

  function openEbaySearch() {
    const q = buildEbaySearchQuery({ player: draft?.player, year: draft?.year, brand: draft?.brand, card_number: draft?.card_number });
    const url = "https://www.ebay.ca/sch/i.html?_nkw=" + encodeURIComponent(q || "trading card");
    window.open(url, "_blank", "noopener,noreferrer");
  }


  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <img className="logoImg" src={ShadowFoxLogo} alt="ShadowFox SC" />
          <div>
            <h1>ShadowFox SC – CardTrack MVP</h1>
            <div className="small">Scan • Confirm • Collect</div>
          </div>
        </div>
        <div className="nav">
          <button className={"pill " + (tab === "scan" ? "active" : "")} onClick={() => setTab("scan")}>Scan</button>
          <button className={"pill " + (tab === "collection" ? "active" : "")} onClick={() => setTab("collection")}>Collection</button>
          <button className={"pill " + (tab === "settings" ? "active" : "")} onClick={() => setTab("settings")}>Settings</button>
          <button className="pill" onClick={() => { setBackendStatus(null); setBackendModalOpen(true); }}>Change IP</button>
        </div>
      

  <BackendPrompt
    open={backendModalOpen}
    initial={backendUrl}
    status={backendStatus}
    force={!backendUrl}
    onClose={() => setBackendModalOpen(false)}
    onSave={(url) => {
      setBackend(url);
      setBackendUrl(url);
      setBackendModalOpen(false);
      setBackendStatus(null);
      refreshCards().catch(() => {});
      setTab("scan");
    }}
  />

</div>

<div className="container">

        {tab === "scan" && (
          <div className="grid">
            <div className="card">
              <h2>Camera</h2>
              <CameraCapture onCapture={onCapture} />
              <div className="row" style={{ marginTop: 10 }}>
                <label className="btn" style={{ cursor: "pointer" }}>
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
    const ocr = f ? await ocrExtract(f) : {};
                      if (!f) return;
                      const ok = await validateBackend(backendUrl);
                      if (!ok) return;
                      setBusy(true);
                      try {
                        const paths = await uploadImage(f, backendUrl);
                        setImgPaths(paths);
                        const res = await scanCard(f, backendUrl);
                        setScan(res);
                        setDraft({
        ...(ocr||{}), ...res.extracted, image_front_path: paths.image_front_path, image_cropped_path: paths.image_cropped_path });
                      } catch (err: any) {
                        alert(err?.message || "Scan failed.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                {busy && <div className="small">Working…</div>}
              </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <strong>Smart Match</strong>
            <button type="button" onClick={openEbaySearch}>Search eBay (opens new tab)</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
              Paste an eBay (or other) listing URL, then click Auto‑Fill. No API keys required.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={smartUrl}
                onChange={(e) => setSmartUrl(e.target.value)}
                placeholder="https://www.ebay.ca/itm/..."
                style={{ flex: "1 1 340px" }}
              />
              <button type="button" onClick={smartMatchFromUrl}>Auto‑Fill from URL</button>
            </div>
            {smartMatchStatus ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>{smartMatchStatus}</div>
            ) : null}
          </div>
        </div>


            </div>

            <div className="card">
              <h2>Review & Save</h2>

              {!backendUrl && (
                <div className="small" style={{ color: "#ef4444" }}>
                  Backend URL not set. Go to Settings.
                </div>
              )}

              {imgPaths?.image_cropped_path && backendUrl && (
                <div className="preview" style={{ marginBottom: 10 }}>
                  <img src={imageUrl(imgPaths.image_cropped_path, backendUrl)} alt="Cropped card preview" />
                </div>
              )}

              {scan?.candidates?.length ? (
                <div style={{ marginBottom: 10 }}>
                  <div className="small" style={{ marginBottom: 8 }}>Suggested matches (tap to apply)</div>
                  <div className="list">
                    {scan.candidates.map((c, i) => (
                      <div key={c.checklist_id} className="item">
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: 0 }}>
                            {c.year ?? "—"} {c.brand ?? ""} {c.set_name ?? ""}
                          </h3>
                          <div className="meta">{c.player ?? "—"} • #{c.card_number ?? "—"} • score {c.score}</div>
                        </div>
                        <button className="btn" onClick={() => applyCandidate(i)}>Use</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="small" style={{ marginBottom: 10 }}>
                  No checklist matches yet. You can still save, then import checklist CSV later.
                </div>
              )}

              <div className="kv2">
                <div>
                  <div className="label">Player</div>
                  <input className="input" value={draft.player ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, player: e.target.value })} />
                </div>
                <div>
                  <div className="label">Card #</div>
                  <input className="input" value={draft.card_number ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, card_number: e.target.value })} />
                </div>
                <div>
                  <div className="label">Year</div>
                  <input className="input" inputMode="numeric" value={draft.year ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, year: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <div className="label">Sport</div>
                  <input className="input" value={draft.sport ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, sport: e.target.value })} placeholder="hockey / baseball / football…" />
                </div>
                <div>
                  <div className="label">Brand</div>
                  <input className="input" value={draft.brand ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, brand: e.target.value })} placeholder="Upper Deck / Topps / Panini…" />
                </div>
                <div>
                  <div className="label">Set</div>
                  <input className="input" value={draft.set_name ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, set_name: e.target.value })} placeholder="Series 1 / Prizm / Select…" />
                </div>
                <div>
                  <div className="label">Parallel/Insert</div>
                  <input className="input" value={draft.parallel ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, parallel: e.target.value })} placeholder="Young Guns / Holo / Refractor…" />
                </div>
                <div>
                  <div className="label">Condition</div>
                  <input className="input" value={draft.condition ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, condition: e.target.value })} placeholder="Raw / Graded" />
                </div>
                <div>
                  <div className="label">Grader</div>
                  <input className="input" value={draft.grader ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, grader: e.target.value })} placeholder="PSA / BGS / SGC" />
                </div>
                <div>
                  <div className="label">Grade</div>
                  <input className="input" value={draft.grade ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, grade: e.target.value })} placeholder="10 / 9.5 / 9…" />
                </div>
              </div>

              <div className="label">Notes</div>
              <textarea className="input" rows={3} value={draft.notes ?? ""} onChange={(e) => setDraft({
        ...(ocr||{}), ...draft, notes: e.target.value })} />

              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={saveCard} disabled={busy || !imgPaths}>Save to Collection</button>
                <button className="btn danger" onClick={() => { setScan(null); setDraft({
        ...(ocr||{}),}); setImgPaths(null); }} disabled={busy}>Clear</button>
                {draft.confidence != null && (
                  <div className="small">AI confidence: {Math.round((draft.confidence || 0) * 100)}%</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "collection" && (
          <div className="card">
            <h2>Your Collection</h2>
            <div className="row" style={{ marginBottom: 10 }}>
              <input className="input" placeholder="Search player, set, brand, #, year…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="btn" onClick={() => refreshCards()} disabled={!backendUrl || busy}>Refresh</button>
            </div>

            {!backendUrl ? (
              <div className="small" style={{ color: "#ef4444" }}>Set backend URL in Settings.</div>
            ) : (
              <div className="list">
                {filtered.map((c) => (
                  <div key={c.id} className="item">
                    <div className="thumb">
                      {c.image_cropped_path ? (
                        <img src={imageUrl(c.image_cropped_path, backendUrl)} alt="card" />
                      ) : (
                        <div className="small" style={{ padding: 10 }}>No image</div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3>{c.player ?? "Unknown player"}</h3>
                      <div className="meta">
                        {c.year ?? "—"} • {c.brand ?? "—"} {c.set_name ? `• ${c.set_name}` : ""} • #{c.card_number ?? "—"}
                        {c.parallel ? ` • ${c.parallel}` : ""}
                      </div>
                      {(c.grader || c.grade || c.condition) && (
                        <div className="meta" style={{ marginTop: 4 }}>
                          {c.condition ?? "—"} {c.grader ? `• ${c.grader}` : ""} {c.grade ? `• ${c.grade}` : ""}
                        </div>
                      )}
                      {c.notes && <div className="small" style={{ marginTop: 6 }}>{c.notes}</div>}
                    </div>
                    <button className="btn danger" onClick={() => removeCard(c.id)} disabled={busy}>Delete</button>
                  </div>
                ))}
                {!filtered.length && <div className="small">No cards yet. Go to Scan to add your first one.</div>}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="card">
            <h2>Settings</h2>
            <div className="small" style={{ marginBottom: 10 }}>
              Your app connects to the backend running on your Windows PC (same Wi‑Fi). Tap <b>Change IP</b> to update it.
            </div>

            <div className="label">Current Backend</div>
<div className="field" style={{ borderRadius: 14, border: "1px solid var(--border)", padding: 12, background: "rgba(255,255,255,0.02)" }}>
  <div className="small">{backendUrl || "Not set"}</div>
</div>

<div className="row" style={{ marginTop: 12 }}>
  <button className="btn primary" onClick={() => { setBackendStatus(null); setBackendModalOpen(true); }}>
    Change IP / Host
  </button>
  <button className="btn" onClick={() => validateBackend(backendUrl)} disabled={!backendUrl}>Test Connection</button>
</div>

            <div className="small" style={{ marginTop: 12 }}>
              Checklist import (CSV) is on the backend at <code>/checklist/import</code> (MVP). Next step is adding an Import screen in the app.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
