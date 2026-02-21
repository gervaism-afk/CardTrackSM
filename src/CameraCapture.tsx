import React, { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (blob: Blob) => void | Promise<void>;
  onUpload?: (file: File) => void | Promise<void>;
  disabled?: boolean;
};

export default function CameraCapture({ onCapture, onUpload, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);

  const hasGetUserMedia =
    typeof navigator !== "undefined" &&
    (navigator as any).mediaDevices &&
    typeof (navigator as any).mediaDevices.getUserMedia === "function";

  const isSecure =
    typeof window !== "undefined" &&
    (window.isSecureContext || window.location.hostname === "localhost");

  useEffect(() => {
    let stream: MediaStream | null = null;

    const start = async () => {
      setErr(null);

      // If camera is unavailable (or not HTTPS), we still allow manual upload.
      if (!hasGetUserMedia) {
        setErr("Camera not available on this browser. Use Upload instead.");
        return;
      }
      if (!isSecure) {
        setErr("Camera requires HTTPS (or localhost). Use Upload instead.");
        return;
      }

      try {
        stream = await (navigator as any).mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
      } catch (e: any) {
        setErr(e?.message || "Could not access camera. Use Upload instead.");
      }
    };

    start();

    return () => {
      try {
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, [hasGetUserMedia, isSecure]);

  const capture = async () => {
    if (disabled) return;
    if (!videoRef.current) return;

    const video = videoRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );

    if (!blob) return;
    await onCapture(blob);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {streaming ? (
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block" }} />
        </div>
      ) : (
        <div className="hint">{err || "Camera preview unavailable. Use Upload."}</div>
      )}

      <div className="row">
        <button className="btn primary" onClick={capture} disabled={disabled || !streaming}>
          Take Photo
        </button>

        <label className="btn" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
          Upload Photo
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            disabled={disabled}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              e.target.value = "";
              if (onUpload) await onUpload(f);
              else await onCapture(f);
            }}
          />
        </label>
      </div>
    </div>
  );
}
