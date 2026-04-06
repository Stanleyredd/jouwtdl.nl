"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";

export type VoiceStatus =
  | "idle"
  | "requesting-permission"
  | "preparing-recorder"
  | "recording"
  | "stopping"
  | "uploading"
  | "transcribing"
  | "success"
  | "unsupported"
  | "error";

type CancelReason =
  | "user-cancel"
  | "component-unmount"
  | "replaced-by-new-request"
  | "startup-timeout"
  | "explicit-reset"
  | "recorder-error";

type StartupPhase =
  | "requesting-permission"
  | "preparing-recorder"
  | "waiting-for-recorder-start";

interface ActiveVoiceRequest {
  id: number;
  phase: StartupPhase;
  cancelled: boolean;
  cancelReason: CancelReason | null;
}

export interface VoiceResult {
  status: VoiceStatus;
  supported: boolean;
  transcript: string;
  error: string | null;
  language: string;
  activeRequestId: number | null;
  isRecording: boolean;
  isBusy: boolean;
  recordingSeconds: number;
  debugEntries: string[];
  start: () => void;
  stop: () => void;
  reset: () => void;
}

const DEFAULT_LANGUAGE = "nl-NL";
const DEFAULT_TRANSCRIPTION_LANGUAGE = "nl";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MICROPHONE_TIMEOUT_MS = 10000;
const STARTUP_TIMEOUT_MS = 5000;
const START_CONFIRMATION_DELAY_MS = 180;
const UPLOAD_HINT_DELAY_MS = 350;
const POST_STOP_TIMEOUT_MS = 30000;
const MAX_DEBUG_ENTRIES = 10;

// This hook records audio locally with MediaRecorder, then sends the finished
// audio file to the app's transcription route. Browser recording support still
// varies, so startup is guarded with explicit checkpoints and a timeout rather
// than assuming recorder.start() always succeeds.
export function useVoiceTranscription(
  onTranscript: (transcript: string) => void,
): VoiceResult {
  const transcriptHandlerRef = useRef(onTranscript);
  const statusRef = useRef<VoiceStatus>("idle");
  const supportedRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef<ActiveVoiceRequest | null>(null);
  const startPendingRef = useRef(false);
  const startConfirmedRef = useRef(false);
  const slowMicrophoneWarningRef = useRef(false);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const microphoneTimerRef = useRef<number | null>(null);
  const startupTimerRef = useRef<number | null>(null);
  const startConfirmationTimerRef = useRef<number | null>(null);
  const uploadHintTimerRef = useRef<number | null>(null);
  const postStopTimerRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [supported, setSupported] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [debugEntries, setDebugEntries] = useState<string[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);

  useEffect(() => {
    transcriptHandlerRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    mountedRef.current = true;
    const canRecord = supportsMediaRecording();
    supportedRef.current = canRecord;
    setSupported(canRecord);
    setStatus(canRecord ? "idle" : "unsupported");
    debugVoiceEvent("availability-checked", {
      mediaDevices: typeof navigator !== "undefined" ? Boolean(navigator.mediaDevices) : false,
      getUserMedia:
        typeof navigator !== "undefined"
          ? typeof navigator.mediaDevices?.getUserMedia === "function"
          : false,
      mediaRecorder:
        typeof window !== "undefined" ? typeof window.MediaRecorder !== "undefined" : false,
    });
    if (process.env.NODE_ENV === "development") {
      setDebugEntries((current) => {
        const next = [
          ...current,
          `availability-checked ${JSON.stringify({
            mediaDevices:
              typeof navigator !== "undefined" ? Boolean(navigator.mediaDevices) : false,
            getUserMedia:
              typeof navigator !== "undefined"
                ? typeof navigator.mediaDevices?.getUserMedia === "function"
                : false,
            mediaRecorder:
              typeof window !== "undefined" ? typeof window.MediaRecorder !== "undefined" : false,
          })}`,
        ];
        return next.slice(-MAX_DEBUG_ENTRIES);
      });
    }

    return () => {
      mountedRef.current = false;
      if (activeRequestRef.current) {
        const request = activeRequestRef.current;
        request.cancelled = true;
        request.cancelReason = "component-unmount";
        activeRequestRef.current = null;
        debugVoiceEvent("cancel-invoked", {
          requestId: request.id,
          phase: request.phase,
          reason: "component-unmount",
        });
        debugVoiceEvent("component-unmount", {
          requestId: request.id,
          phase: request.phase,
        });
      }
      startPendingRef.current = false;
      startConfirmedRef.current = false;
      slowMicrophoneWarningRef.current = false;
      clearStartupTimer(microphoneTimerRef);
      clearStartupTimer(startupTimerRef);
      clearStartupTimer(startConfirmationTimerRef);
      clearUploadHintTimer(uploadHintTimerRef);
      clearStartupTimer(postStopTimerRef);
      stopRecordingTimer(recordingTimerRef);
      abortUpload(uploadControllerRef);
      uploadControllerRef.current = null;
      disposeRecorder(mediaRecorderRef);
      stopMediaStream(streamRef);
      setActiveRequestId(null);
      debugVoiceEvent("cleanup-completed");
    };
  }, []);

  function start() {
    void startRecording();
  }

  async function startRecording() {
    setDebugEntries([]);
    logVoiceEvent("start-clicked", {
      status,
      supported: supportedRef.current,
    });

    const availabilityError = getRecordingAvailabilityError();

    if (availabilityError) {
      setStatus("unsupported");
      setError(availabilityError);
      logVoiceEvent("availability-missing", { message: availabilityError });
      return;
    }

    if (
      startPendingRef.current ||
      mediaRecorderRef.current ||
      uploadControllerRef.current ||
      status === "stopping" ||
      status === "uploading" ||
      status === "transcribing"
    ) {
      return;
    }

    if (activeRequestRef.current) {
      cancelRequest(activeRequestRef.current, "replaced-by-new-request");
      cleanupStartupResources(mediaRecorderRef, streamRef);
    }

    const request: ActiveVoiceRequest = {
      id: nextRequestId(requestIdRef),
      phase: "requesting-permission",
      cancelled: false,
      cancelReason: null,
    };
    activeRequestRef.current = request;
    const requestId = request.id;
    startPendingRef.current = true;
    startConfirmedRef.current = false;
    slowMicrophoneWarningRef.current = false;
    logVoiceEvent("request-created", {
      requestId,
      phase: request.phase,
    });
    setActiveRequestId(requestId);
    logVoiceEvent("request-activated", {
      requestId,
      phase: request.phase,
    });

    clearStartupTimer(microphoneTimerRef);
    clearStartupTimer(startupTimerRef);
    clearStartupTimer(startConfirmationTimerRef);
    clearUploadHintTimer(uploadHintTimerRef);
    clearStartupTimer(postStopTimerRef);
    stopRecordingTimer(recordingTimerRef);
    abortUpload(uploadControllerRef);
    uploadControllerRef.current = null;
    cleanupStartupResources(mediaRecorderRef, streamRef);

    chunksRef.current = [];
    setTranscript("");
    setError(null);
    setRecordingSeconds(0);
    setStatus("requesting-permission");

    logVoiceEvent("checking-media-devices", {
      mediaDevices: Boolean(navigator.mediaDevices),
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
      mediaRecorder: typeof window.MediaRecorder !== "undefined",
    });

    logVoiceEvent("requesting-microphone", {
      requestId,
      language: DEFAULT_LANGUAGE,
    });

    startStartupTimer(microphoneTimerRef, requestId, MICROPHONE_TIMEOUT_MS, () => {
      logVoiceEvent("getUserMedia-timeout-fired", {
        requestId,
        timeoutMs: MICROPHONE_TIMEOUT_MS,
      });

      if (!isRequestCurrent(request) || !startPendingRef.current) {
        return;
      }

      slowMicrophoneWarningRef.current = true;
      setError("Microphone access is taking longer than expected. Check permissions and retry if needed.");
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      clearStartupTimer(microphoneTimerRef);

      if (!isRequestCurrent(request)) {
        logVoiceEvent("getUserMedia-resolved-after-cancel", {
          requestId,
          tracks: stream.getAudioTracks().length,
          reason: getInactiveRequestReason(request, mountedRef),
        });
        stopTracks(stream);
        return;
      }

      logVoiceEvent("getUserMedia-resolved", {
        requestId,
        stream: Boolean(stream),
        tracks: stream.getAudioTracks().length,
        afterSlowWarning: slowMicrophoneWarningRef.current,
      });

      streamRef.current = stream;
      chunksRef.current = [];
      setError(null);
      setStatus("preparing-recorder");
      request.phase = "preparing-recorder";

      const audioTracks = stream.getAudioTracks();

      if (audioTracks.length === 0) {
        failStart(request, "Microphone opened, but no usable audio track was available.");
        return;
      }

      logVoiceEvent("stream-tracks-found", {
        requestId,
        tracks: audioTracks.map((track) => ({
          label: track.label || "unlabeled",
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
        })),
      });

      const liveTrack = audioTracks.find((track) => track.readyState === "live");

      if (!liveTrack) {
        failStart(request, "Microphone opened, but no usable audio track was available.");
        return;
      }

      const selectedMimeType = getPreferredMimeType();
      logVoiceEvent("selected-mime-type", {
        requestId,
        mimeType: selectedMimeType || "browser-default",
      });
      logVoiceEvent("media-recorder-constructing", {
        requestId,
        mimeType: selectedMimeType || "browser-default",
      });

      const recorderCreation = createRecorder(stream, selectedMimeType);
      const recorder = recorderCreation.recorder;

      if (!recorder) {
        failStart(
          request,
          recorderCreation.error ??
            "The browser could not create an audio recorder for this microphone stream.",
        );
        return;
      }

      mediaRecorderRef.current = recorder;

      logVoiceEvent("media-recorder-constructed", {
        requestId,
        recorderState: recorder.state,
        mimeType: recorder.mimeType || "browser-default",
        selectedMimeType: recorderCreation.mimeType || "browser-default",
      });
      request.phase = "waiting-for-recorder-start";

      recorder.onstart = () => {
        if (!isRequestCurrent(request)) {
          return;
        }

        startConfirmedRef.current = true;
        if (activeRequestRef.current?.id === request.id) {
          activeRequestRef.current = null;
        }
        setActiveRequestId(null);

        logVoiceEvent("onstart-fired", {
          requestId,
          recorderState: recorder.state,
        });

        clearStartupTimer(startupTimerRef);
        clearStartupTimer(startConfirmationTimerRef);
        startPendingRef.current = false;
        slowMicrophoneWarningRef.current = false;
        recordingStartedAtRef.current = Date.now();
        startRecordingTimer(recordingStartedAtRef, recordingTimerRef, setRecordingSeconds);
        setStatus("recording");
      };

      recorder.ondataavailable = (event) => {
        if (!mountedRef.current) {
          return;
        }

        if (event.data.size > 0) {
          chunksRef.current.push(event.data);

          logVoiceEvent("chunk", {
            requestId,
            size: event.data.size,
            totalChunks: chunksRef.current.length,
          });
        }
      };

      recorder.onerror = (event) => {
        const details = (event as Event & { error?: DOMException }).error;

        logVoiceEvent("onerror-fired", {
          requestId,
          name: details?.name ?? null,
          message: details?.message ?? null,
          recorderState: recorder.state,
        });

        if (!isRequestAlive(request)) {
          return;
        }

        if (startPendingRef.current) {
          failStart(request, getRecorderEventErrorMessage(details), "recorder-error");
          return;
        }

        reportError("Recording stopped unexpectedly. Try again.");
      };

      recorder.onstop = () => {
        logVoiceEvent("onstop-handler-entered", {
          requestId,
          cancelled: request.cancelled,
          cancelReason: request.cancelReason,
        });
        logVoiceEvent("onstop-fired", {
          requestId,
          chunks: chunksRef.current.length,
          recorderState: recorder.state,
        });

        clearStartupTimer(startupTimerRef);
        clearStartupTimer(startConfirmationTimerRef);
        stopRecordingTimer(recordingTimerRef);
        startPendingRef.current = false;
        slowMicrophoneWarningRef.current = false;

        if (!isRequestAlive(request)) {
          logVoiceEvent("onstop-ignored", {
            requestId,
            cancelled: request.cancelled,
            cancelReason: request.cancelReason,
          });
          return;
        }

        if (!startConfirmedRef.current && chunksRef.current.length === 0) {
          failStart(request, "The recorder stopped before recording began.", "recorder-error");
          return;
        }

        void finalizeRecording(
          requestId,
          recorder.mimeType || inferAudioMimeType(chunksRef.current) || "audio/webm",
        );
      };

      try {
        logVoiceEvent("recorder-state-before-start", {
          requestId,
          recorderState: recorder.state,
        });
        logVoiceEvent("recorder-start-called", {
          requestId,
          mimeType: recorder.mimeType || "browser-default",
        });

        recorder.start(1000);

        startStartupTimer(startupTimerRef, requestId, STARTUP_TIMEOUT_MS, () => {
          const trackSummaries = summarizeTracks(streamRef.current);

          logVoiceEvent("recorder-startup-timeout-fired", {
            requestId,
            stream: Boolean(streamRef.current),
            recorder: Boolean(mediaRecorderRef.current),
            recorderState: mediaRecorderRef.current?.state ?? "none",
            tracks: trackSummaries,
          });

          failStart(request, "Recording could not start after microphone access.", "startup-timeout");
        });

        logVoiceEvent("recorder-state-after-start", {
          requestId,
          recorderState: recorder.state,
        });

        startConfirmationTimerRef.current = window.setTimeout(() => {
          if (
            isRequestCurrent(request) &&
            startPendingRef.current &&
            !startConfirmedRef.current &&
            recorder.state === "recording"
          ) {
            startConfirmedRef.current = true;
            clearStartupTimer(startupTimerRef);
            startPendingRef.current = false;
            slowMicrophoneWarningRef.current = false;
            if (activeRequestRef.current?.id === request.id) {
              activeRequestRef.current = null;
            }
            setActiveRequestId(null);
            recordingStartedAtRef.current = Date.now();
            startRecordingTimer(recordingStartedAtRef, recordingTimerRef, setRecordingSeconds);
            setStatus("recording");

            logVoiceEvent("recording-state-detected-without-onstart", {
              requestId,
              recorderState: recorder.state,
            });
          }
        }, START_CONFIRMATION_DELAY_MS);
      } catch (caughtError) {
        logVoiceEvent("recorder-start-threw", describeError(caughtError));
        failStart(request, getRecorderStartErrorMessage(caughtError), "recorder-error");
      }
    } catch (caughtError) {
      clearStartupTimer(microphoneTimerRef);

      if (!isRequestCurrent(request)) {
        logVoiceEvent("getUserMedia-rejected-after-cancel", {
          ...describeError(caughtError),
          reason: getInactiveRequestReason(request, mountedRef),
        });
        return;
      }

      logVoiceEvent("getUserMedia-rejected", describeError(caughtError));
      failStart(request, getMicrophoneErrorMessage(caughtError));
    }
  }

  function stop() {
    if (status === "requesting-permission" || status === "preparing-recorder") {
      cancelPendingStart();
      return;
    }

    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    logVoiceEvent("stop-clicked", {
      requestId: requestIdRef.current,
      state: recorder.state,
    });

    clearStartupTimer(startupTimerRef);
    clearStartupTimer(startConfirmationTimerRef);
    startPendingRef.current = false;
    slowMicrophoneWarningRef.current = false;
    setStatus("stopping");

    try {
      recorder.stop();
    } catch (caughtError) {
      logVoiceEvent("stop-threw", describeError(caughtError));
      reportError("Recording could not be stopped cleanly. Try again.");
    }
  }

  function reset() {
    if (activeRequestRef.current) {
      cancelRequest(activeRequestRef.current, "explicit-reset");
    }
    startPendingRef.current = false;
    startConfirmedRef.current = false;
    slowMicrophoneWarningRef.current = false;
    clearStartupTimer(microphoneTimerRef);
    clearStartupTimer(startupTimerRef);
    clearStartupTimer(startConfirmationTimerRef);
    clearUploadHintTimer(uploadHintTimerRef);
    clearStartupTimer(postStopTimerRef);
    stopRecordingTimer(recordingTimerRef);
    abortUpload(uploadControllerRef);
    uploadControllerRef.current = null;
    cleanupStartupResources(mediaRecorderRef, streamRef);
    chunksRef.current = [];
    setTranscript("");
    setError(null);
    setRecordingSeconds(0);
    setActiveRequestId(null);
    setStatus(supportedRef.current ? "idle" : "unsupported");
  }

  async function finalizeRecording(requestId: number, mimeType: string) {
    logVoiceEvent("post-stop-finalize-started", {
      requestId,
      chunks: chunksRef.current.length,
      mimeType,
    });

    const recordedChunks = [...chunksRef.current];
    chunksRef.current = [];
    releaseRecorder(mediaRecorderRef);
    stopMediaStream(streamRef);

    if (requestIdRef.current !== requestId || !mountedRef.current) {
      logVoiceEvent("post-stop-finalize-discarded", {
        requestId,
        currentRequestId: requestIdRef.current,
        mounted: mountedRef.current,
      });
      return;
    }

    if (recordedChunks.length === 0) {
      reportError("No audio was captured. Try again.");
      return;
    }

    let audioBlob: Blob;

    try {
      logVoiceEvent("blob-creation-started", {
        requestId,
        chunks: recordedChunks.length,
      });
      audioBlob = new Blob(recordedChunks, { type: mimeType || "audio/webm" });
      logVoiceEvent("blob-created", {
        requestId,
        size: audioBlob.size,
        type: audioBlob.type || "audio/webm",
      });
    } catch (caughtError) {
      logVoiceEvent("post-stop-error-caught", {
        requestId,
        stage: "blob-create",
        ...describeError(caughtError),
      });
      reportError("The recorded audio could not be prepared. Try again.");
      return;
    }

    if (audioBlob.size === 0) {
      reportError("No audio was captured. Try again.");
      return;
    }

    if (audioBlob.size > MAX_AUDIO_BYTES) {
      reportError("This recording is too large. Keep it under about 2 minutes.");
      return;
    }

    let file: File;

    try {
      file = new File([audioBlob], buildAudioFileName(audioBlob.type), {
        type: audioBlob.type || "audio/webm",
      });
      logVoiceEvent("file-created", {
        requestId,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    } catch (caughtError) {
      logVoiceEvent("post-stop-error-caught", {
        requestId,
        stage: "file-create",
        ...describeError(caughtError),
      });
      reportError("The recording file could not be prepared. Try again.");
      return;
    }

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("language", DEFAULT_TRANSCRIPTION_LANGUAGE);

    setStatus("uploading");
    logVoiceEvent("status-changed", {
      requestId,
      status: "uploading",
    });
    setError(null);

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    startStartupTimer(postStopTimerRef, requestId, POST_STOP_TIMEOUT_MS, () => {
      logVoiceEvent("post-stop-timeout-fired", {
        requestId,
        timeoutMs: POST_STOP_TIMEOUT_MS,
      });

      controller.abort();
      reportError("Audio processing took too long. Try again.");
    });

    clearUploadHintTimer(uploadHintTimerRef);
    uploadHintTimerRef.current = window.setTimeout(() => {
      if (requestIdRef.current === requestId && mountedRef.current) {
        setStatus("transcribing");
        logVoiceEvent("status-changed", {
          requestId,
          status: "transcribing",
          source: "upload-hint",
        });
      }
    }, UPLOAD_HINT_DELAY_MS);

    logVoiceEvent("upload-started", {
      requestId,
      size: file.size,
      type: file.type,
      language: DEFAULT_TRANSCRIPTION_LANGUAGE,
    });

    try {
      logVoiceEvent("transcription-request-started", { requestId });
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      logVoiceEvent("upload-finished", {
        requestId,
        ok: response.ok,
        status: response.status,
      });

      if (requestIdRef.current !== requestId || !mountedRef.current) {
        logVoiceEvent("post-stop-response-discarded", {
          requestId,
          currentRequestId: requestIdRef.current,
          mounted: mountedRef.current,
        });
        return;
      }

      clearUploadHintTimer(uploadHintTimerRef);
      setStatus("transcribing");
      logVoiceEvent("status-changed", {
        requestId,
        status: "transcribing",
        source: "response-received",
      });

      logVoiceEvent("transcription-response-received", {
        requestId,
        status: response.status,
      });

      const payload = (await response.json()) as {
        transcript?: string;
        error?: string;
      };
      logVoiceEvent("transcript-parsed", {
        requestId,
        characters: payload.transcript?.length ?? 0,
        hasError: Boolean(payload.error),
      });

      if (!response.ok) {
        throw new Error(payload.error || "Transcription failed. Try again.");
      }

      const nextTranscript = normalizeTranscript(payload.transcript ?? "");

      if (!nextTranscript) {
        throw new Error("No transcript was returned. Try again.");
      }

      logVoiceEvent("transcript-ready", {
        requestId,
        characters: nextTranscript.length,
      });

      setTranscript(nextTranscript);
      setStatus("success");
      logVoiceEvent("status-changed", {
        requestId,
        status: "success",
      });
      transcriptHandlerRef.current(nextTranscript);
    } catch (caughtError) {
      if (isAbortError(caughtError)) {
        logVoiceEvent("upload-aborted", { requestId });
        return;
      }

      logVoiceEvent("post-stop-error-caught", {
        requestId,
        stage: "transcription",
        ...describeError(caughtError),
      });
      logVoiceEvent("transcription-error", describeError(caughtError));
      reportError(getTranscriptionErrorMessage(caughtError));
    } finally {
      clearUploadHintTimer(uploadHintTimerRef);
      clearStartupTimer(postStopTimerRef);
      uploadControllerRef.current = null;
    }
  }

  function failStart(
    request: ActiveVoiceRequest,
    message: string,
    cancelReason: CancelReason | null = null,
  ) {
    logVoiceEvent("startup-failed", {
      requestId: request.id,
      message,
      reason: cancelReason,
    });

    if (cancelReason) {
      cancelRequest(request, cancelReason);
    } else {
      completeRequest(request);
    }

    startPendingRef.current = false;
    startConfirmedRef.current = false;
    slowMicrophoneWarningRef.current = false;
    clearStartupTimer(microphoneTimerRef);
    clearStartupTimer(startupTimerRef);
    clearStartupTimer(startConfirmationTimerRef);
    clearUploadHintTimer(uploadHintTimerRef);
    clearStartupTimer(postStopTimerRef);
    stopRecordingTimer(recordingTimerRef);
    abortUpload(uploadControllerRef);
    uploadControllerRef.current = null;
    chunksRef.current = [];
    setRecordingSeconds(0);
    cleanupStartupResources(mediaRecorderRef, streamRef);
    setStatus(supportedRef.current ? "error" : "unsupported");
    setError(message);
    setActiveRequestId(null);
  }

  function reportError(message: string) {
    logVoiceEvent("voice-error", { message });

    if (activeRequestRef.current) {
      cancelRequest(activeRequestRef.current, "recorder-error");
    }
    startPendingRef.current = false;
    startConfirmedRef.current = false;
    slowMicrophoneWarningRef.current = false;
    clearStartupTimer(microphoneTimerRef);
    clearStartupTimer(startupTimerRef);
    clearStartupTimer(startConfirmationTimerRef);
    clearUploadHintTimer(uploadHintTimerRef);
    clearStartupTimer(postStopTimerRef);
    stopRecordingTimer(recordingTimerRef);
    abortUpload(uploadControllerRef);
    uploadControllerRef.current = null;
    chunksRef.current = [];
    setRecordingSeconds(0);
    cleanupStartupResources(mediaRecorderRef, streamRef);
    setStatus(supportedRef.current ? "error" : "unsupported");
    setError(message);
    setActiveRequestId(null);
  }

  return {
    status,
    supported,
    transcript,
    error,
    language: DEFAULT_LANGUAGE,
    activeRequestId,
    isRecording: status === "recording",
    isBusy:
      status === "requesting-permission" ||
      status === "preparing-recorder" ||
      status === "recording" ||
      status === "stopping" ||
      status === "uploading" ||
      status === "transcribing",
    recordingSeconds,
    debugEntries,
    start,
    stop,
    reset,
  };

  function isRequestCurrent(request: ActiveVoiceRequest) {
    return mountedRef.current && activeRequestRef.current?.id === request.id && !request.cancelled;
  }

  function isRequestAlive(request: ActiveVoiceRequest) {
    return mountedRef.current && !request.cancelled;
  }

  function completeRequest(request: ActiveVoiceRequest) {
    request.cancelled = true;
    request.cancelReason = null;

    if (activeRequestRef.current?.id === request.id) {
      activeRequestRef.current = null;
    }
    setActiveRequestId(null);

    logVoiceEvent("request-completed", {
      requestId: request.id,
      phase: request.phase,
    });
  }

  function cancelRequest(request: ActiveVoiceRequest, reason: CancelReason) {
    request.cancelled = true;
    request.cancelReason = reason;

    if (activeRequestRef.current?.id === request.id) {
      activeRequestRef.current = null;
    }
    setActiveRequestId(null);

    logVoiceEvent("cancel-invoked", {
      requestId: request.id,
      phase: request.phase,
      reason,
    });
    logVoiceEvent(reason, {
      requestId: request.id,
      phase: request.phase,
    });
  }

  function cancelPendingStart() {
    if (activeRequestRef.current) {
      cancelRequest(activeRequestRef.current, "user-cancel");
    }
    startPendingRef.current = false;
    startConfirmedRef.current = false;
    slowMicrophoneWarningRef.current = false;
    clearStartupTimer(microphoneTimerRef);
    clearStartupTimer(startupTimerRef);
    clearStartupTimer(startConfirmationTimerRef);
    cleanupStartupResources(mediaRecorderRef, streamRef);
    chunksRef.current = [];
    setRecordingSeconds(0);
    setError(null);
    setStatus(supportedRef.current ? "idle" : "unsupported");
  }

  function logVoiceEvent(event: string, payload?: Record<string, unknown>) {
    debugVoiceEvent(event, payload);

    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const suffix = payload ? ` ${JSON.stringify(payload)}` : "";
    setDebugEntries((current) => {
      const next = [...current, `${event}${suffix}`];
      return next.slice(-MAX_DEBUG_ENTRIES);
    });
  }
}

function supportsMediaRecording() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function createRecorder(stream: MediaStream, selectedMimeType: string) {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return {
      recorder: null,
      mimeType: selectedMimeType,
      error: "MediaRecorder is not available in this browser.",
    };
  }

  try {
    return {
      recorder: selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream),
      mimeType: selectedMimeType,
      error: null,
    };
  } catch (caughtError) {
    debugVoiceEvent("media-recorder-create-failed", describeError(caughtError));

    try {
      return {
        recorder: new MediaRecorder(stream),
        mimeType: "",
        error: null,
      };
    } catch (fallbackError) {
      debugVoiceEvent("media-recorder-fallback-failed", describeError(fallbackError));
      return {
        recorder: null,
        mimeType: selectedMimeType,
        error: getRecorderConstructionErrorMessage(caughtError, fallbackError),
      };
    }
  }
}

function getPreferredMimeType() {
  if (
    typeof window === "undefined" ||
    typeof window.MediaRecorder === "undefined" ||
    typeof window.MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }

  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  for (const candidate of candidates) {
    const supported = window.MediaRecorder.isTypeSupported(candidate);
    debugVoiceEvent("mime-type-checked", { candidate, supported });

    if (supported) {
      return candidate;
    }
  }

  debugVoiceEvent("mime-type-fallback", { candidate: "browser-default" });
  return "";
}

function inferAudioMimeType(chunks: Blob[]) {
  return chunks.find((chunk) => chunk.type)?.type ?? "";
}

function buildAudioFileName(mimeType: string) {
  if (mimeType.includes("ogg")) {
    return "journal-note.ogg";
  }

  if (mimeType.includes("mp4") || mimeType.includes("mpeg") || mimeType.includes("aac")) {
    return "journal-note.m4a";
  }

  return "journal-note.webm";
}

function getMicrophoneErrorMessage(caughtError: unknown) {
  if (!(caughtError instanceof DOMException)) {
    return "Microphone access could not be requested.";
  }

  switch (caughtError.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Microphone permission was denied.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found.";
    case "NotReadableError":
    case "TrackStartError":
      return "Microphone is unavailable right now. Try closing other apps that use it.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "This browser does not fully support audio recording.";
    case "AbortError":
      return "Microphone access was interrupted before recording could begin.";
    case "InvalidStateError":
      return "The page was not ready to start recording.";
    default:
      return `Microphone access failed: ${caughtError.name}.`;
  }
}

function getRecorderStartErrorMessage(caughtError: unknown) {
  if (caughtError instanceof DOMException && caughtError.name === "NotSupportedError") {
    return "The browser rejected the requested recording format.";
  }

  if (caughtError instanceof DOMException && caughtError.name === "InvalidStateError") {
    return "The recorder could not start from its current state.";
  }

  if (caughtError instanceof Error && caughtError.message.trim()) {
    return `Recorder start failed: ${caughtError.message}`;
  }

  return "Recorder start failed before recording became active.";
}

function getRecorderEventErrorMessage(details?: DOMException | null) {
  if (!details) {
    return "The recorder reported an unknown startup error.";
  }

  switch (details.name) {
    case "NotSupportedError":
      return "The browser rejected the selected recording format.";
    case "InvalidStateError":
      return "The recorder was not ready to start.";
    case "SecurityError":
      return "The browser blocked the recorder for security reasons.";
    default:
      return `The recorder reported ${details.name}.`;
  }
}

function getTranscriptionErrorMessage(caughtError: unknown) {
  if (caughtError instanceof Error && caughtError.message.trim()) {
    return caughtError.message;
  }

  return "Transcription failed. Try again or type manually.";
}

function normalizeTranscript(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function nextRequestId(requestIdRef: MutableRefObject<number>) {
  requestIdRef.current += 1;
  return requestIdRef.current;
}

function getRecordingAvailabilityError() {
  if (typeof navigator === "undefined") {
    return "Browser recording is not available in this environment.";
  }

  if (!navigator.mediaDevices) {
    return "navigator.mediaDevices is unavailable in this browser.";
  }

  if (typeof navigator.mediaDevices.getUserMedia !== "function") {
    return "getUserMedia is not available in this browser.";
  }

  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "MediaRecorder is not available in this browser.";
  }

  return null;
}

function startStartupTimer(
  startupTimerRef: MutableRefObject<number | null>,
  requestId: number,
  timeoutMs: number,
  onTimeout: () => void,
) {
  clearStartupTimer(startupTimerRef);
  startupTimerRef.current = window.setTimeout(() => {
    onTimeout();
  }, timeoutMs);

  debugVoiceEvent("startup-timer-set", {
    requestId,
    timeoutMs,
  });
}

function clearStartupTimer(startupTimerRef: MutableRefObject<number | null>) {
  if (startupTimerRef.current !== null) {
    window.clearTimeout(startupTimerRef.current);
    startupTimerRef.current = null;
  }
}

function summarizeTracks(stream: MediaStream | null) {
  if (!stream) {
    return [];
  }

  return stream.getAudioTracks().map((track) => ({
    label: track.label || "unlabeled",
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
  }));
}

function cleanupStartupResources(
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>,
  streamRef: MutableRefObject<MediaStream | null>,
) {
  disposeRecorder(mediaRecorderRef);
  stopMediaStream(streamRef);
}

function startRecordingTimer(
  recordingStartedAtRef: MutableRefObject<number>,
  recordingTimerRef: MutableRefObject<number | null>,
  onTick: (seconds: number) => void,
) {
  stopRecordingTimer(recordingTimerRef);
  onTick(0);

  recordingTimerRef.current = window.setInterval(() => {
    const seconds = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
    onTick(seconds);
  }, 500);
}

function stopRecordingTimer(recordingTimerRef: MutableRefObject<number | null>) {
  if (recordingTimerRef.current !== null) {
    window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }
}

function clearUploadHintTimer(uploadHintTimerRef: MutableRefObject<number | null>) {
  if (uploadHintTimerRef.current !== null) {
    window.clearTimeout(uploadHintTimerRef.current);
    uploadHintTimerRef.current = null;
  }
}

function releaseRecorder(mediaRecorderRef: MutableRefObject<MediaRecorder | null>) {
  const recorder = mediaRecorderRef.current;

  if (!recorder) {
    return;
  }

  recorder.onstart = null;
  recorder.ondataavailable = null;
  recorder.onerror = null;
  recorder.onstop = null;
  mediaRecorderRef.current = null;
}

function disposeRecorder(mediaRecorderRef: MutableRefObject<MediaRecorder | null>) {
  const recorder = mediaRecorderRef.current;

  if (!recorder) {
    return;
  }

  recorder.onstart = null;
  recorder.ondataavailable = null;
  recorder.onerror = null;
  recorder.onstop = null;

  if (recorder.state !== "inactive") {
    try {
      recorder.stop();
    } catch {
      // Ignore cleanup failures and continue resetting the session.
    }
  }

  mediaRecorderRef.current = null;
}

function stopMediaStream(streamRef: MutableRefObject<MediaStream | null>) {
  if (!streamRef.current) {
    return;
  }

  stopTracks(streamRef.current);
  streamRef.current = null;
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function getInactiveRequestReason(
  request: ActiveVoiceRequest,
  mountedRef: MutableRefObject<boolean>,
) {
  if (request.cancelReason) {
    return request.cancelReason;
  }

  return mountedRef.current ? "inactive-request" : "component-unmount";
}

function abortUpload(uploadControllerRef: MutableRefObject<AbortController | null>) {
  uploadControllerRef.current?.abort();
}

function isAbortError(caughtError: unknown) {
  return caughtError instanceof DOMException && caughtError.name === "AbortError";
}

function describeError(caughtError: unknown) {
  if (caughtError instanceof Error) {
    return {
      name: caughtError.name,
      message: caughtError.message,
    };
  }

  return {
    value: String(caughtError),
  };
}

function getRecorderConstructionErrorMessage(primaryError: unknown, fallbackError: unknown) {
  const primary = primaryError instanceof Error ? primaryError.message : String(primaryError);
  const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);

  return `MediaRecorder construction failed. Primary: ${primary}. Fallback: ${fallback}.`;
}

function debugVoiceEvent(event: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[voice]", event, payload ?? {});
}
