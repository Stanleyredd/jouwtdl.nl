"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

import { useVoiceTranscription, type VoiceResult } from "@/hooks/use-voice-transcription";

interface ActiveVoiceTarget {
  sectionId: string;
  fieldId: string;
}

interface JournalVoiceContextValue {
  voice: VoiceResult;
  activeVoiceTarget: ActiveVoiceTarget | null;
  voiceInsertHandlerRef: MutableRefObject<
    ((sectionId: string, fieldId: string, transcript: string) => void) | null
  >;
  startVoiceForField: (sectionId: string, fieldId: string) => void;
  cancelVoice: () => void;
  stopVoice: () => void;
  resetVoice: (sectionId: string, fieldId: string) => void;
}

const JournalVoiceContext = createContext<JournalVoiceContextValue | null>(null);

export function JournalVoiceProvider({ children }: { children: ReactNode }) {
  const [activeVoiceTarget, setActiveVoiceTarget] = useState<ActiveVoiceTarget | null>(null);
  const activeVoiceTargetRef = useRef(activeVoiceTarget);
  const voiceInsertHandlerRef = useRef<
    ((sectionId: string, fieldId: string, transcript: string) => void) | null
  >(null);

  useEffect(() => {
    activeVoiceTargetRef.current = activeVoiceTarget;
  }, [activeVoiceTarget]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.debug("[voice-owner]", "voice-owner-mounted");

    return () => {
      console.debug("[voice-owner]", "voice-owner-unmounted");
    };
  }, []);

  const voice = useVoiceTranscription((transcript) => {
    const target = activeVoiceTargetRef.current;

    if (!target || !voiceInsertHandlerRef.current) {
      return;
    }

    voiceInsertHandlerRef.current(target.sectionId, target.fieldId, transcript);
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.debug("[voice-owner]", "voice-owner-state", {
      activeFieldId: activeVoiceTarget
        ? `${activeVoiceTarget.sectionId}.${activeVoiceTarget.fieldId}`
        : null,
      activeRequestId: voice.activeRequestId,
      status: voice.status,
    });
  }, [activeVoiceTarget, voice.activeRequestId, voice.status]);

  function isSameVoiceTarget(sectionId: string, fieldId: string) {
    return (
      activeVoiceTargetRef.current?.sectionId === sectionId &&
      activeVoiceTargetRef.current?.fieldId === fieldId
    );
  }

  function startVoiceForField(sectionId: string, fieldId: string) {
    if (!isSameVoiceTarget(sectionId, fieldId)) {
      if (voice.status === "success" || voice.status === "error") {
        voice.reset();
      }

      setActiveVoiceTarget({ sectionId, fieldId });
    }

    voice.start();
  }

  function cancelVoice() {
    voice.stop();
    setActiveVoiceTarget(null);
  }

  function stopVoice() {
    voice.stop();
  }

  function resetVoice(sectionId: string, fieldId: string) {
    if (
      activeVoiceTargetRef.current?.sectionId === sectionId &&
      activeVoiceTargetRef.current?.fieldId === fieldId
    ) {
      voice.reset();
      setActiveVoiceTarget(null);
    }
  }

  const value: JournalVoiceContextValue = {
    voice,
    activeVoiceTarget,
    voiceInsertHandlerRef,
    startVoiceForField,
    cancelVoice,
    stopVoice,
    resetVoice,
  };

  return (
    <JournalVoiceContext.Provider value={value}>
      {children}
    </JournalVoiceContext.Provider>
  );
}

export function useJournalVoice() {
  const context = useContext(JournalVoiceContext);

  if (!context) {
    throw new Error("useJournalVoice must be used within JournalVoiceProvider.");
  }

  return context;
}
