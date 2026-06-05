/** Videodan birinchi kadr — reel poster sifatida backendga yuborish. */
export async function captureVideoPoster(file: File): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    const fail = () => {
      cleanup();
      resolve(null);
    };

    const timeout = window.setTimeout(fail, 12_000);

    video.onerror = fail;

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.25, Math.max(0, (video.duration || 1) * 0.05));
      } catch {
        fail();
      }
    };

    video.onseeked = () => {
      window.clearTimeout(timeout);
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        fail();
        return;
      }
      const canvas = document.createElement("canvas");
      const max = 720;
      const scale = Math.min(1, max / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        fail();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          resolve(blob);
        },
        "image/jpeg",
        0.82,
      );
    };
  });
}
