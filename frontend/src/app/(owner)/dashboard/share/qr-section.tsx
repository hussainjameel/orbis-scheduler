"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrErrorBoundary } from "./qr-error-boundary";

function QrFallback() {
  // Exact copy per UC10's E1 — a contained failure, not a page-level error
  // state, so this replaces only the QR image area.
  return <p className="text-sm text-text-secondary">QR code unavailable. Use the URL or embed snippet instead.</p>;
}

export function QrSection({ bookingUrl }: { bookingUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrFailed, setQrFailed] = useState(false);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "booking-page-qr.png";
    link.click();
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <QrErrorBoundary fallback={<QrFallback />} onError={() => setQrFailed(true)}>
        <div className="rounded-sm border border-border-default bg-white p-3">
          <QRCodeCanvas ref={canvasRef} value={bookingUrl} size={160} marginSize={2} title="Booking page QR code" />
        </div>
      </QrErrorBoundary>

      {!qrFailed && (
        <Button type="button" variant="secondary" size="sm" onClick={handleDownload}>
          <Download className="size-3.5" strokeWidth={1.5} />
          Download
        </Button>
      )}
    </div>
  );
}
