import { JournalVoiceProvider } from "@/providers/journal-voice-provider";

export default function JournalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <JournalVoiceProvider>{children}</JournalVoiceProvider>;
}
