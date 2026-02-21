import React, { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (file: File) => void | Promise<void>;
  disabled?: boolean;
};

export default function CameraCapture({ onCapture, disabled }: Props) {
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

      if (!hasGetUserMedia) {
        setErr(
          "Camera preview isn’t available in this browser/environment. Use Upload Photo instead."
        );
        return;
      }

      if (!isSecure) {
        setErr(
          "Camera preview requires a secure connection (HTTPS). You opened this app over HTTP on your network. Use Upload Photo (recommended) or run the app over HTTPS."
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
      } catch (e: any) {
        setErr(e?.message || "Camera permission denied or unavailable.");
      }
    };

    start();

    return () => {
      setStreaming(false);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureFrame = async () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(v, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (!blob) return;

    const file = new File([blob], `card_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    await onCapture(file);
  };

  return (
    <div>
      {streaming && (
        <div className="preview">
          <video ref={videoRef} playsInline style={{ width: "100%" }} />
        </div>
      )}

      {err && (
        <div className="small" style={{ color: "#ef4444", marginTop: 10 }}>
          {err}
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        {streaming && (
          <button className="btn primary" onClick={captureFrame} disabled={disabled}>
            Take Photo
          </button>
        )}

        <label className={"btn " + (streaming ? "" : "primary")} style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
          Upload Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            disabled={disabled}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              await onCapture(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {!isSecure && (
        <div className="small" style={{ marginTop: 10 }}>
          Tip: On Android, opening the app via <b>http://PC-IP:5173</b> often blocks camera preview.
          The <b>Upload Photo</b> button still lets you take a photo and continue.
        </div>
      )}
    </div>
  );
}
