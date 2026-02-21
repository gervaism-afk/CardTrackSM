import React from "react";

type Props = {
  open: boolean;
  initial: string;
  onSave: (url: string) => void;
  onAutoDiscover: () => Promise<string | null>;
  onClose?: () => void;
  force?: boolean;
  status?: string | null;
};

export default function BackendPrompt(props: Props) {
  const { open, initial, onSave, onAutoDiscover, onClose, force, status } = props;
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState("8000");
  const [searching, setSearching] = React.useState(false);
  const [foundMsg, setFoundMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    try {
      const u = initial ? new URL(initial) : null;
      if (u) {
        setHost(u.hostname || "");
        setPort(u.port || "8000");
      } else {
        setHost("");
        setPort("8000");
      }
    } catch {
      setHost("");
      setPort("8000");
    }
  }, [open, initial]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setFoundMsg(null);
      setSearching(true);
      try {
        const discovered = await onAutoDiscover();
        if (cancelled) return;
        if (discovered) {
          setFoundMsg(`Found backend at ${discovered}`);
          onSave(discovered);
        } else {
          setFoundMsg("Couldn’t auto-find your PC. You can type the IP below.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const url = host.trim() ? `http://${host.trim()}:${(port || "8000").trim()}` : "";

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Connect to your Windows PC</h2>
        <div className="small">
          CardTrack runs on your Windows PC and your phone connects over the same Wi‑Fi.
        </div>

        {(searching || foundMsg) && (
          <div className="small" style={{ marginTop: 10 }}>
            {searching ? "Searching your Wi‑Fi for the CardTrack Backend…" : foundMsg}
          </div>
        )}

        {status && (
          <div className="small" style={{ marginTop: 10, color: "#ef4444" }}>
            {status}
          </div>
        )}

        <div className="kv2" style={{ marginTop: 12 }}>
          <div>
            <div className="label">PC IP / Hostname</div>
            <input
              className="input"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.0.25"
            />
          </div>
          <div>
            <div className="label">Port</div>
            <input
              className="input"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
              placeholder="8000"
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <button
            className="btn"
            onClick={async () => {
              setFoundMsg(null);
              setSearching(true);
              try {
                const discovered = await onAutoDiscover();
                if (discovered) {
                  onSave(discovered);
                } else {
                  setFoundMsg("Couldn’t auto-find your PC. Type the IP below.");
                }
              } finally {
                setSearching(false);
              }
            }}
            disabled={searching}
          >
            Find Automatically
          </button>

          <div className="row" style={{ marginTop: 0, justifyContent: "flex-end" }}>
            {!force && (
              <button className="btn" onClick={() => onClose && onClose()}>
                Cancel
              </button>
            )}
            <button className="btn primary" disabled={!url} onClick={() => onSave(url)}>
              Save
            </button>
          </div>
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          Tip: On Windows, run <b>ipconfig</b> and use the <b>IPv4 Address</b>.
        </div>
      </div>
    </div>
  );
}
