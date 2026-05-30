"use client";

import { useCallback, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { transcribeVoiceSearch } from "@/lib/api";

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const SPEECH_LANGS = ["ru-RU", "en-US"];

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function recordAudioBlob(maxMs = 5000): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const timer = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, maxMs);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      window.clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error("recording_failed"));
    };
    recorder.onstop = () => {
      window.clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: mime }));
    };
    recorder.start(200);
  });
}

export function useVoiceSearch(onTranscript: (text: string) => void) {
  const { push } = useToast();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const busyRef = useRef(false);

  const runWhisperFallback = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      push("Mikrofon ruxsati yo'q yoki brauzer qo'llab-quvvatlamaydi", "error");
      return;
    }
    push("Gapiring… (5 soniya)", "info");
    const blob = await recordAudioBlob();
    if (blob.size < 800) {
      push("Ovoz yozilmadi. Qayta urinib ko'ring.", "error");
      return;
    }
    const { text } = await transcribeVoiceSearch(blob);
    const trimmed = text.trim();
    if (!trimmed) {
      push("Ovoz aniqlanmadi", "error");
      return;
    }
    onTranscript(trimmed);
  }, [onTranscript, push]);

  const startListening = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setListening(true);

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      void runWhisperFallback()
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("503") || msg.includes("unavailable")) {
            push("Ovozli qidiruv serverda sozlanmagan (OPENAI_API_KEY)", "error");
          } else {
            push("Ovozli qidiruv ishlamadi. Chrome yoki Safari sinab ko'ring.", "error");
          }
        })
        .finally(() => {
          busyRef.current = false;
          setListening(false);
        });
      return;
    }

    let langIndex = 0;
    const recognition = new Ctor();
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    const tryNextLang = () => {
      recognition.lang = SPEECH_LANGS[langIndex] ?? "ru-RU";
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) {
          onTranscript(transcript);
        } else {
          push("Ovoz aniqlanmadi", "error");
        }
      };
      recognition.onerror = (event) => {
        const code = event.error ?? "";
        if (code === "not-allowed") {
          push("Mikrofon ruxsatini yoqing", "error");
          busyRef.current = false;
          setListening(false);
          return;
        }
        if (langIndex < SPEECH_LANGS.length - 1) {
          langIndex += 1;
          try {
            recognition.start();
          } catch {
            void runWhisperFallback().finally(() => {
              busyRef.current = false;
              setListening(false);
            });
          }
          return;
        }
        void runWhisperFallback()
          .catch(() => push("Ovozli qidiruv vaqtincha ishlamayapti", "error"))
          .finally(() => {
            busyRef.current = false;
            setListening(false);
          });
      };
      recognition.onend = () => {
        busyRef.current = false;
        setListening(false);
        recognitionRef.current = null;
      };
      try {
        recognition.start();
        push("Tinglayapman…", "info");
      } catch {
        void runWhisperFallback().finally(() => {
          busyRef.current = false;
          setListening(false);
        });
      }
    };

    tryNextLang();
  }, [onTranscript, push, runWhisperFallback]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    busyRef.current = false;
    setListening(false);
  }, []);

  return { listening, startListening, stopListening, speechSupported: Boolean(getSpeechRecognitionCtor()) };
}
