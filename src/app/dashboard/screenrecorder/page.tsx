"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickMimeType(): string | null {
  const preferred = "video/webm;codecs=vp9";
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(preferred)) {
    return preferred;
  }
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm")) {
    return "video/webm";
  }
  return null;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function ScreenRecorderPage() {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const hasSupport =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === "function" &&
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined";
    setSupported(hasSupport);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  }, []);

  const finishRecording = useCallback(() => {
    setRecording(false);
    stopTimer();
    cleanupStream();

    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || "video/webm" });
    chunksRef.current = [];

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (blob.size > 0) {
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setDownloadName(`recording-${timestampForFilename()}.webm`);
    } else {
      setError("That recording came out empty — nothing was captured. Try recording for a few seconds before stopping.");
    }
  }, [cleanupStream, stopTimer]);

  const handleStop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      finishRecording();
    }
  }, [finishRecording]);

  const handleStart = useCallback(async () => {
    setError(null);

    if (!supported) {
      setError("Screen recording isn't supported in this browser. Try the latest Chrome, Edge, or Firefox on desktop.");
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("This browser doesn't support recording video/webm. Try the latest Chrome, Edge, or Firefox.");
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setDownloadName(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      // Some browsers (notably Firefox) reject the whole request when audio is
      // asked for. Fall back to a video-only capture before giving up.
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        setError("Screen recording permission was denied, or no screen was selected.");
        return;
      }
    }

    streamRef.current = stream;
    chunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      setError("Could not start recording with this browser's video encoder.");
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    recorder.onstop = () => {
      finishRecording();
    };

    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      videoTrack.onended = () => {
        handleStop();
      };
    }

    recorder.start(1000);
    setRecording(true);
    setElapsed(0);
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, [supported, finishRecording, handleStop, stopTimer]);

  // The <video> only exists while recording, so it can't be wired up inside
  // handleStart — the ref is still null at that point. Attach it once React has
  // actually mounted the element.
  useEffect(() => {
    if (!recording) return;
    const el = liveVideoRef.current;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => {});
    }
  }, [recording]);

  useEffect(() => {
    return () => {
      stopTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          // Already torn down — nothing to do.
        }
      }
      cleanupStream();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [stopTimer, cleanupStream]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Screen Recorder</h1>
      <p className="mt-1 text-sm text-muted">
        Record your screen and download the clip. Everything happens locally in your browser — nothing is uploaded.
      </p>
      <p className="mt-1 text-xs text-muted">
        Desktop only, and the file is WebM. Audio depends on your browser — Chrome and Edge can
        capture tab or system audio if you tick &ldquo;Share audio&rdquo; in the picker; Firefox and
        Safari usually capture video only. There is no trimming or webcam overlay.
      </p>

      <div className="card animate-fade-in mt-6 max-w-xl p-4">
        {!supported && (
          <p className="mb-4 text-sm text-danger">
            Screen recording isn&apos;t supported in this browser. Try the latest Chrome, Edge, or Firefox on desktop.
          </p>
        )}

        <div className="flex items-center gap-4">
          {!recording ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={!supported}
              className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start recording
            </button>
          ) : (
            <button type="button" onClick={handleStop} className="btn btn-secondary text-sm">
              Stop recording
            </button>
          )}

          {recording && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
              </span>
              <span className="tabular-nums">{formatElapsed(elapsed)}</span>
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        {recording && (
          <div className="mt-6 flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Live preview</h2>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-md border border-border bg-surface"
            />
          </div>
        )}

        {previewUrl && downloadName && (
          <div className="mt-6 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Preview</h2>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={previewUrl} controls className="w-full rounded-md border border-border bg-surface" />
            <a href={previewUrl} download={downloadName} className="btn btn-primary w-fit text-sm">
              Download {downloadName}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
