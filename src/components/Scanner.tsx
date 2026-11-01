"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

type CamState = "idle" | "starting" | "on" | "denied" | "unsupported" | "error";

const SAME_CODE_MS = 2500; // the camera sees the same label many times per second

/**
 * Camera scanner for QR codes and 1D barcodes (Code128 etc. on vendor boxes). ZXing is loaded on demand,
 * so it works on iPhone Safari too, which has no native BarcodeDetector. Starts on a tap (iOS needs a gesture).
 */
export function Scanner({ onScan, paused = false }: { onScan: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const last = useRef({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<CamState>("idle");
  const [torch, setTorch] = useState(false);

  onScanRef.current = onScan;
  pausedRef.current = paused;

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setState("unsupported");
      return;
    }
    setState("starting");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        (result) => {
          if (!result || pausedRef.current) return;
          const text = result.getText();
          const now = Date.now();
          if (text === last.current.text && now - last.current.at < SAME_CODE_MS) return;
          last.current = { text, at: now };
          navigator.vibrate?.(60);
          onScanRef.current(text);
        },
      );
      setState("on");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
    }
  }

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setTorch(false);
    setState("idle");
  }

  async function toggleTorch() {
    const c = controlsRef.current;
    if (!c?.switchTorch) return;
    try {
      await c.switchTorch(!torch);
      setTorch(!torch);
    } catch {
      /* torch not available on this camera */
    }
  }

  const message: Partial<Record<CamState, string>> = {
    starting: "Starting camera…",
    denied: "Camera access was blocked. Allow it in your browser settings, or type the serial below.",
    unsupported: "This browser can't use the camera here. Type or paste the serial below.",
    error: "Couldn't start the camera. Type or paste the serial below.",
  };

  return (
    <div className="relative overflow-hidden rounded-[22px] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]">
      <video
        ref={videoRef}
        className={`aspect-[4/3] w-full object-cover ${state === "on" ? "" : "invisible"}`}
        muted
        playsInline
        aria-label="Camera preview"
      />

      {state === "on" && (
        <>
          {/* aiming frame: wide enough for a barcode, tall enough for a QR */}
          <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[42%] -translate-y-1/2 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,.35),inset_0_0_0_2px_rgba(255,194,122,.9)]" aria-hidden />
          {paused && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 font-mono text-xs uppercase tracking-widest text-[#FFE1B8]">
              Paused
            </div>
          )}
          <div className="absolute bottom-3 right-3 flex gap-2">
            {controlsRef.current?.switchTorch && (
              <button type="button" onClick={toggleTorch} className="btn-ghost px-3 py-1.5 text-xs" aria-pressed={torch}>
                {torch ? "Light off" : "Light"}
              </button>
            )}
            <button type="button" onClick={stop} className="btn-ghost px-3 py-1.5 text-xs">
              Stop
            </button>
          </div>
        </>
      )}

      {state !== "on" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          {state === "idle" ? (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFC27A" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10" />
              </svg>
              <button type="button" onClick={start} className="btn-primary">
                Start camera
              </button>
              <p className="max-w-xs text-xs text-[#AEB8C5]">Point at the QR or barcode on the box or device label.</p>
            </>
          ) : (
            <>
              <p className="max-w-xs text-sm text-[#C3CBD6]">{message[state]}</p>
              {state !== "starting" && state !== "unsupported" && (
                <button type="button" onClick={start} className="btn-ghost px-3 py-1.5 text-xs">
                  Try again
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
