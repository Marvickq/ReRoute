"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import type { Evidence } from "@/types";

interface LocalEvidence {
  id: string;
  type: "photo" | "voice";
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  evidence?: Evidence;
  error?: string;
}

export default function NewLotPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<LocalEvidence[]>([]);
  const [voice, setVoice] = useState<LocalEvidence | null>(null);
  const [textDescription, setTextDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      if (voice) URL.revokeObjectURL(voice.preview);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const handlePhotoSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const newPhotos: LocalEvidence[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        newPhotos.push({
          id: `local-${Date.now()}-${i}`,
          type: "photo",
          file,
          preview: "",
          uploading: false,
          uploaded: false,
          error: "File too large (max 10MB)",
        });
        continue;
      }
      newPhotos.push({
        id: `local-${Date.now()}-${i}`,
        type: "photo",
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
      });
    }
    setPhotos((prev) => [...prev, ...newPhotos]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handlePhotoSelect(e.dataTransfer.files);
    },
    [handlePhotoSelect],
  );

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        const preview = URL.createObjectURL(blob);

        setVoice({
          id: `voice-${Date.now()}`,
          type: "voice",
          file,
          preview,
          uploading: false,
          uploaded: false,
        });

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      setSubmitError(
        "Microphone access denied. Please allow microphone access and try again.",
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const removeVoice = useCallback(() => {
    if (voice) URL.revokeObjectURL(voice.preview);
    setVoice(null);
    setRecordingTime(0);
  }, [voice]);

  const uploadEvidence = async (
    item: LocalEvidence,
  ): Promise<Evidence | null> => {
    const formData = new FormData();
    formData.append("file", item.file);

    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const { evidence } = await res.json();
      return evidence;
    } catch (err) {
      throw err;
    }
  };

  const hasAnyEvidence =
    photos.some((p) => p.uploaded && !p.error) ||
    voice?.uploaded ||
    textDescription.trim().length > 0;

  const allUploaded =
    photos.filter((p) => !p.error).every((p) => p.uploaded) &&
    (voice === null || voice.uploaded);

  const handleCreateLot = async () => {
    if (!hasAnyEvidence) {
      setSubmitError(
        "Add at least one evidence item: photo, voice, or text description.",
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const evidenceIds: string[] = [];

      for (const photo of photos) {
        if (photo.error || photo.uploaded) continue;
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, uploading: true } : p)),
        );
        try {
          const ev = await uploadEvidence(photo);
          if (ev) {
            evidenceIds.push(ev.evidence_id);
            setPhotos((prev) =>
              prev.map((p) =>
                p.id === photo.id
                  ? { ...p, uploading: false, uploaded: true, evidence: ev }
                  : p,
              ),
            );
          }
        } catch (err) {
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === photo.id
                ? {
                    ...p,
                    uploading: false,
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : p,
            ),
          );
        }
      }

      if (voice && !voice.uploaded) {
        setVoice((prev) => (prev ? { ...prev, uploading: true } : prev));
        try {
          const ev = await uploadEvidence(voice);
          if (ev) {
            evidenceIds.push(ev.evidence_id);
            setVoice((prev) =>
              prev
                ? { ...prev, uploading: false, uploaded: true, evidence: ev }
                : prev,
            );
          }
        } catch (err) {
          setVoice((prev) =>
            prev
              ? {
                  ...prev,
                  uploading: false,
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : prev,
          );
        }
      }

      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textDescription.trim() || undefined,
          evidence_ids: evidenceIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create lot");
      }

      const { lot } = await res.json();
      router.push(`/lots/${lot.lot_id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const photoCount = photos.filter((p) => !p.error).length;
  const hasVoice = voice !== null;
  const hasText = textDescription.trim().length > 0;

  return (
    <AppShell title="New Material Lot">
      <PageHeader
        title="New Material Lot"
        description="Capture evidence from the physical pickup. Photo, voice, and text — provide what you have."
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Photo Upload */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-4">
              Photo Evidence
            </h3>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-[#22c55e] bg-[#052e16]/30"
                  : "border-[#333] hover:border-[#444]"
              }`}
            >
              <svg
                className="w-8 h-8 mx-auto mb-3 text-[#444]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                />
              </svg>
              <p className="text-[13px] text-[#666] mb-1">
                Click to upload or drag photos here
              </p>
              <p className="text-[11px] text-[#444]">
                PNG, JPG, WebP up to 10MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoSelect(e.target.files)}
            />

            {photos.length > 0 && (
              <div className="mt-4 space-y-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-3 py-2 px-3 bg-[#0a0a0a] rounded-md border border-[#2a2a2a]"
                  >
                    {photo.preview ? (
                      <img
                        src={photo.preview}
                        alt=""
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#222] flex items-center justify-center">
                        <span className="text-[9px] text-[#666]">IMG</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#a0a0a0] truncate">
                        {photo.file.name}
                      </p>
                      <p className="text-[10px] text-[#444]">
                        {(photo.file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    {photo.uploading && (
                      <span className="text-[11px] text-[#3b82f6]">
                        Uploading...
                      </span>
                    )}
                    {photo.uploaded && (
                      <svg
                        className="w-4 h-4 text-[#22c55e]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    )}
                    {photo.error && (
                      <span className="text-[11px] text-[#ef4444]">
                        {photo.error}
                      </span>
                    )}
                    {!photo.uploading && (
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="text-[#666] hover:text-[#ef4444] transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Recording */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-4">
              Voice Description
            </h3>
            {!voice ? (
              <div className="border border-[#333] rounded-lg p-6 text-center">
                <svg
                  className="w-8 h-8 mx-auto mb-3 text-[#444]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
                <p className="text-[13px] text-[#666] mb-3">
                  Record a voice description of the pickup
                </p>
                {isRecording ? (
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-[13px] text-[#ef4444] font-mono">
                      {formatTime(recordingTime)}
                    </span>
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 bg-[#ef4444] text-white rounded-md text-[12px] font-medium hover:bg-[#dc2626] transition-colors"
                    >
                      Stop Recording
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startRecording}
                    className="px-4 py-2 bg-[#222] border border-[#333] rounded-md text-[12px] text-[#a0a0a0] hover:bg-[#2a2a2a] transition-colors"
                  >
                    Start Recording
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-[#2a2a2a] rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <svg
                    className="w-5 h-5 text-[#22c55e]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                    />
                  </svg>
                  <span className="text-[13px] text-[#f0f0f0]">
                    Voice recorded
                  </span>
                  {voice.uploading && (
                    <span className="text-[11px] text-[#3b82f6]">
                      Uploading...
                    </span>
                  )}
                  {voice.uploaded && (
                    <svg
                      className="w-4 h-4 text-[#22c55e]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  )}
                  {voice.error && (
                    <span className="text-[11px] text-[#ef4444]">
                      {voice.error}
                    </span>
                  )}
                </div>
                <audio
                  controls
                  src={voice.preview}
                  className="w-full mb-3"
                  preload="metadata"
                />
                <button
                  onClick={removeVoice}
                  className="text-[12px] text-[#666] hover:text-[#ef4444] transition-colors"
                >
                  Remove recording
                </button>
              </div>
            )}
          </div>

          {/* Text Description */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-4">
              Text Description
            </h3>
            <textarea
              value={textDescription}
              onChange={(e) => setTextDescription(e.target.value)}
              placeholder='Describe the pickup in your own words. E.g., "3 phones, one old laptop, two batteries. Laptop battery looks a little swollen."'
              className="w-full h-28 bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2.5 text-[13px] text-[#f0f0f0] placeholder:text-[#444] focus:outline-none focus:border-[#555] resize-none"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">
              Evidence Summary
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#666]">Photos</span>
                <span className="text-[#a0a0a0]">
                  {photoCount} {photoCount === 1 ? "photo" : "photos"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#666]">Voice</span>
                <span className="text-[#a0a0a0]">
                  {hasVoice ? "Recorded" : "Not recorded"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#666]">Text</span>
                <span className="text-[#a0a0a0]">
                  {hasText
                    ? `${textDescription.trim().length} chars`
                    : "Not provided"}
                </span>
              </div>
            </div>
          </div>

          {/* Lot Info */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">
              What happens next
            </h3>
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  label: "Evidence capture",
                  desc: "You are here",
                  active: true,
                },
                {
                  step: "2",
                  label: "AI analysis",
                  desc: "Multimodal understanding",
                },
                {
                  step: "3",
                  label: "Material intelligence",
                  desc: "Structured extraction",
                },
                { step: "4", label: "Safety check", desc: "Hazard detection" },
                { step: "5", label: "Routing", desc: "Facility matching" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5 ${
                      s.active
                        ? "bg-[#22c55e] text-black font-medium"
                        : "bg-[#222] border border-[#333] text-[#666]"
                    }`}
                  >
                    {s.step}
                  </span>
                  <div>
                    <div
                      className={`text-[12px] ${s.active ? "text-[#f0f0f0]" : "text-[#a0a0a0]"}`}
                    >
                      {s.label}
                    </div>
                    <div className="text-[11px] text-[#444]">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {submitError && (
            <div className="bg-[#450a0a] border border-[#7f1d1d] rounded-lg p-4">
              <p className="text-[12px] text-[#ef4444]">{submitError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleCreateLot}
            disabled={isSubmitting || !hasAnyEvidence}
            className={`w-full py-2.5 rounded-md text-[13px] font-medium transition-colors ${
              isSubmitting || !hasAnyEvidence
                ? "bg-[#222] text-[#444] cursor-not-allowed"
                : "bg-[#22c55e] text-black hover:bg-[#16a34a]"
            }`}
          >
            {isSubmitting ? "Creating Material Lot..." : "Create Material Lot"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
