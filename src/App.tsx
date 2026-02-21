import React, { useMemo, useState } from "react";
import CameraCapture from "./CameraCapture";
import BackendPrompt from "./BackendPrompt";
import {
  CardCreate,
  CardOut,
  EbayImageItem,
  ebaySearchByImage,
  ebaySoldUrl,
  getBackendUrl,
  setBackendUrl,
} from "./api";
import { ocrExtract } from "./ocr";
import { parseFromListingTitle, buildEbaySearchQuery } from "./smartMatch";
import ShadowFoxLogo from "./assets/shadowfox-logo.png";

type Tab = "scan" | "collection" | "settings";

const LS_CARDS = "shadowfox_cardtrack_cards_v1";

function loadCards(): CardOut[] {
  try {
    const raw = localStorage.getItem(LS_CARDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CardOut[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCards(cards: CardOut[]) {
  localStorage.setItem(LS_CARDS, JSON.stringify(cards));
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // browser-friendly base64
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function CardField(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <div className="fieldLabel">{props.label}</div>
      <input className="fieldInput" value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder || ""} />
    </label>
  );
}

export default function App() {
  React.useEffect(() => {
    document.title = "ShadowFox SC - CardTrack MVP";
  }, []);

  const [tab, setTab] = useState<Tab>("scan");
  const [backendUrl, setBackend] = useState<string>(getBackendUrl() || "");
  const [backendModalOpen, setBackendModalOpen] = useState<boolean>(false);

  const [cards, setCards] = useState<CardOut[]>(() => loadCards());
  const [busy, setBusy] = useState(false);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);

  const [form, setForm] = useState<CardCreate>({
    sport: "",
    year: null,
    brand: "",
    set_name: "",
    player: "",
    team: "",
    card_number: "",
    parallel: "",
    condition: "",
    grader: "",
    grade: "",
    notes: "",
    listing_url: "",
    listing_title: "",
    ocr_text: "",
    confidence: null,
  });

  const [ocrText, setOcrText] = useState<string>("");
  const [ebayItems, setEbayItems] = useState<EbayImageItem[]>([]);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const ebayQuery = useMemo(() => buildEbaySearchQuery(form), [form]);

  function update<K extends keyof CardCreate>(k: K, v: CardCreate[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function resetForm() {
    setForm({
      sport: "",
      year: null,
      brand: "",
      set_name: "",
      player: "",
      team: "",
      card_number: "",
      parallel: "",
      condition: "",
      grader: "",
      grade: "",
      notes: "",
      listing_url: "",
      listing_title: "",
      ocr_text: "",
      confidence: null,
    });
    setOcrText("");
    setEbayItems([]);
    setSuggestedPrice(null);
    setLastImageUrl(null);
  }

  async function handleImage(file: File) {
    setBusy(true);
    try {
      // Preview
      setLastImageUrl(URL.createObjectURL(file));

      // 1) OCR (local)
      const ocr = await ocrExtract(file);
      setOcrText(ocr.text || "");
      update("ocr_text", ocr.text || "");
      update("confidence", ocr.confidence ?? null);

      // 2) Parse basic fields from OCR
      const parsed = parseFromListingTitle(ocr.text || "");
      setForm((p) => ({ ...p, ...parsed }));

      // 3) eBay image recognition (online) — returns active listings + suggested median
      const base64 = await fileToBase64(file);
      const res = await ebaySearchByImage(base64);
      setEbayItems(res.items || []);
      setSuggestedPrice(typeof res.suggestedPriceCad === "number" ? res.suggestedPriceCad : null);
    } finally {
      setBusy(false);
    }
  }

  function addToCollection() {
    const id = Math.max(0, ...cards.map((c) => c.id)) + 1;
    const card: CardOut = { ...form, id };
    const next = [card, ...cards];
    setCards(next);
    saveCards(next);
    setTab("collection");
  }

  function removeCard(id: number) {
    const next = cards.filter((c) => c.id !== id);
    setCards(next);
    saveCards(next);
  }

  async function openSoldComps() {
    const q = ebayQuery || form.listing_title || form.player || "";
    const { soldUrl } = await ebaySoldUrl(q);
    window.open(soldUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <img className="brandLogo" src={ShadowFoxLogo} alt="ShadowFox SC" />
          <div className="brandText">
            <div className="brandTitle">ShadowFox SC - CardTrack MVP</div>
            <div className="brandSub">Scan • Match • Track your collection</div>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === "scan" ? "tab active" : "tab"} onClick={() => setTab("scan")}>Scan</button>
          <button className={tab === "collection" ? "tab active" : "tab"} onClick={() => setTab("collection")}>Collection</button>
          <button className={tab === "settings" ? "tab active" : "tab"} onClick={() => setTab("settings")}>Settings</button>
        </nav>
      </header>

      <main className="content">
        {tab === "scan" && (
          <div className="grid">
            <section className="card">
              <div className="cardHeader">
                <h2>Scan a card</h2>
                <div className="actions">
                  <button className="btn" onClick={resetForm} disabled={busy}>Reset</button>
                </div>
              </div>

              <div className="capture">
                <CameraCapture
                  disabled={busy}
                  onCapture={async (blob) => {
                    const file = new File([blob], `card_${Date.now()}.jpg`, { type: "image/jpeg" });
                    await handleImage(file);
                  }}
                  onUpload={async (file) => {
                    await handleImage(file);
                  }}
                />
              </div>

              {lastImageUrl && (
                <div className="preview">
                  <img src={lastImageUrl} alt="Last scan" />
                </div>
              )}

              {busy && <div className="hint">Working… (OCR + eBay image match)</div>}

              <div className="row">
                <button className="btn primary" onClick={addToCollection} disabled={busy}>Add to collection</button>
                <button className="btn" onClick={openSoldComps} disabled={busy}>Open Sold Comps (eBay.ca)</button>
              </div>

              {suggestedPrice !== null && (
                <div className="priceBox">
                  <div className="priceLabel">Suggested listing price (median of active listings)</div>
                  <div className="priceValue">${suggestedPrice.toFixed(2)} CAD</div>
                </div>
              )}

              {ebayItems.length > 0 && (
                <div className="results">
                  <div className="resultsTitle">Image match results (eBay.ca active listings)</div>
                  <div className="resultsList">
                    {ebayItems.slice(0, 6).map((it, idx) => (
                      <a className="resultItem" key={idx} href={it.itemWebUrl || "#"} target="_blank" rel="noreferrer">
                        <img className="resultImg" src={it.image?.imageUrl || ""} alt="" />
                        <div className="resultMeta">
                          <div className="resultTitleText">{it.title}</div>
                          <div className="resultPrice">{it.price?.value ? `$${it.price.value} ${it.price.currency || "CAD"}` : ""}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="card">
              <div className="cardHeader">
                <h2>Detected info</h2>
              </div>

              <div className="formGrid">
                <CardField label="Sport" value={String(form.sport || "")} onChange={(v) => update("sport", v)} placeholder="Hockey / Baseball / Football…" />
                <CardField label="Year" value={form.year ? String(form.year) : ""} onChange={(v) => update("year", v ? Number(v) : null)} placeholder="2021" />
                <CardField label="Brand" value={String(form.brand || "")} onChange={(v) => update("brand", v)} placeholder="Upper Deck / Topps / Panini…" />
                <CardField label="Set" value={String(form.set_name || "")} onChange={(v) => update("set_name", v)} placeholder="Series / Set name" />
                <CardField label="Player" value={String(form.player || "")} onChange={(v) => update("player", v)} placeholder="Player name" />
                <CardField label="Team" value={String(form.team || "")} onChange={(v) => update("team", v)} placeholder="Team" />
                <CardField label="Card #" value={String(form.card_number || "")} onChange={(v) => update("card_number", v)} placeholder="123" />
                <CardField label="Parallel" value={String(form.parallel || "")} onChange={(v) => update("parallel", v)} placeholder="Silver / Holo / Auto…" />
                <CardField label="Condition" value={String(form.condition || "")} onChange={(v) => update("condition", v)} placeholder="Raw / NM / Mint" />
                <CardField label="Grader" value={String(form.grader || "")} onChange={(v) => update("grader", v)} placeholder="PSA / BGS / SGC" />
                <CardField label="Grade" value={String(form.grade || "")} onChange={(v) => update("grade", v)} placeholder="10" />
              </div>

              <label className="field">
                <div className="fieldLabel">Notes</div>
                <textarea className="fieldTextArea" value={String(form.notes || "")} onChange={(e) => update("notes", e.target.value)} placeholder="Any notes…" />
              </label>

              <div className="divider" />

              <div className="small">
                <div><b>eBay search query:</b> {ebayQuery || "—"}</div>
                <div className="muted">Tip: click “Open Sold Comps” to check real sold prices and choose your price.</div>
              </div>

              <div className="divider" />

              <details>
                <summary>OCR text</summary>
                <pre className="ocrBox">{ocrText || "—"}</pre>
              </details>
            </section>
          </div>
        )}

        {tab === "collection" && (
          <section className="card">
            <div className="cardHeader">
              <h2>My collection</h2>
              <div className="small muted">{cards.length} card(s)</div>
            </div>

            {cards.length === 0 ? (
              <div className="hint">No cards yet. Scan one and “Add to collection”.</div>
            ) : (
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Sport</th>
                      <th>Year</th>
                      <th>Brand</th>
                      <th>Set</th>
                      <th>Player</th>
                      <th>Card #</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((c) => (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td>{c.sport}</td>
                        <td>{c.year ?? ""}</td>
                        <td>{c.brand}</td>
                        <td>{c.set_name}</td>
                        <td>{c.player}</td>
                        <td>{c.card_number}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn danger" onClick={() => removeCard(c.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "settings" && (
          <section className="card">
            <div className="cardHeader">
              <h2>Settings</h2>
            </div>

            <div className="small muted">
              This web version works without any backend. If you want to also use your optional local backend, you can set it here.
            </div>

            <div className="row">
              <input
                className="fieldInput"
                value={backendUrl}
                onChange={(e) => setBackend(e.target.value)}
                placeholder="Optional backend URL (ex: http://192.168.2.191:8000)"
              />
              <button
                className="btn"
                onClick={() => {
                  setBackendUrl(backendUrl);
                  setBackend(backendUrl);
                  setBackendModalOpen(false);
                }}
              >
                Save
              </button>
            </div>

            <div className="divider" />

            <div className="small">
              <b>eBay integration (required):</b>
              <ol>
                <li>In Cloudflare Pages → your project → Settings → Environment variables, add <code>EBAY_CLIENT_ID</code> and <code>EBAY_CLIENT_SECRET</code>.</li>
                <li>Redeploy.</li>
                <li>Scan a card → image match results will appear under “Image match results”.</li>
              </ol>
            </div>

            <BackendPrompt
              open={backendModalOpen}
              backendUrl={backendUrl}
              onClose={() => setBackendModalOpen(false)}
              onSave={(u) => {
                setBackendUrl(u);
                setBackend(u);
                setBackendModalOpen(false);
              }}
            />
          </section>
        )}
      </main>
    </div>
  );
}
