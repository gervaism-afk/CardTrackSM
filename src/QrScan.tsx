import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (url: string) => void;
};

export default function QrScan({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) { raf = requestAnimationFrame(tick); return; }

      const w = v.videoWidth;
      const h = v.videoHeight;
      if (!w || !h) { raf = requestAnimationFrame(tick); return; }

      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { raf = requestAnimationFrame(tick); return; }

      ctx.drawImage(v, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const code = jsQR(img.data, w, h);
      if (code?.data) {
        const text = code.data.trim();
        // expect http://x.x.x.x:8000
        if (text.startsWith("http://") || text.startsWith("https://")) {
          onDetected(text.replace(/\/+$/, ""));
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        setErr(null);
        setScanning(true);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          raf = requestAnimationFrame(tick);
        }
      } catch (e: any) {
        setErr(e?.message || "Camera permission denied.");
      }
    })();

    return () => {
      cancelled = true;
      setScanning(false);
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Scan QR from your Windows PC</h2>
        <div className="small">Point your camera at the QR code shown in the Windows CardTrack Backend window.</div>

        {err && <div className="small" style={{ color: "#ef4444", marginTop: 10 }}>{err}</div>}

        <div className="preview" style={{ marginTop: 10 }}>
          <video ref={videoRef} style={{ width: "100%" }} playsInline />
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          {scanning ? "Scanning…" : " "}
        </div>
      </div>
    </div>
  );
}
