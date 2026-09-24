"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, ArrowRight, CameraOff } from "lucide-react";
import { Button } from "@/components/ui";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function toPassportId(raw: string) {
  const m = raw.match(/\/p\/([A-Za-z0-9-]+)/);
  return (m ? m[1] : raw).trim();
}

export function Scanner() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [camera, setCamera] = useState<"off" | "on" | "unsupported">("off");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices) return setCamera("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamera("on");
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const detector = new BD({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current) return;
        const codes = await detector.detect(video).catch(() => []);
        if (codes[0]) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          router.push(`/p/${toPassportId(codes[0].rawValue)}`);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setCamera("unsupported");
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl bg-ink text-paper sm:aspect-[16/9]">
        <video ref={videoRef} className={camera === "on" ? "absolute inset-0 h-full w-full object-cover" : "hidden"} muted playsInline />
        {camera === "on" && <div className="absolute inset-[18%] rounded-3xl border-2 border-dashed border-turmeric" />}
        {camera !== "on" && (
          <div className="text-center">
            {camera === "unsupported" ? <CameraOff className="mx-auto text-paper/50" size={36} /> : <Camera className="mx-auto text-turmeric" size={36} />}
            <p className="mt-3 max-w-xs text-sm text-paper/60">
              {camera === "unsupported" ? "Camera scanning isn't available in this browser — enter the ID below or use your phone's camera app." : "Your camera stays on this device; nothing is uploaded."}
            </p>
            {camera === "off" && <Button variant="turmeric" className="mt-4" onClick={start}><Camera size={15} /> Start camera</Button>}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (id.trim()) router.push(`/p/${toPassportId(id)}`);
        }}
        className="flex gap-2"
      >
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. KAPAS-TEE-001" className="h-12 flex-1 rounded-full border border-line bg-card px-5 font-mono text-sm uppercase outline-none focus:border-indigo" />
        <Button type="submit" className="h-12 px-6">Open <ArrowRight size={15} /></Button>
      </form>
    </div>
  );
}
