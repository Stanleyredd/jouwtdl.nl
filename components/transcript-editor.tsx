interface TranscriptEditorProps {
  rawTranscript: string;
  editedTranscript: string;
  onChange: (value: string) => void;
}

export function TranscriptEditor({
  rawTranscript,
  editedTranscript,
  onChange,
}: TranscriptEditorProps) {
  return (
    <section className="app-surface app-panel">
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">Voice notes</p>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Review anything captured from voice.
        </p>
      </div>

      {rawTranscript ? (
        <div className="app-surface-soft mt-4 rounded-[18px] px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
          <p className="mb-2 text-xs uppercase tracking-[0.16em]">Recorded text</p>
          {rawTranscript}
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] border border-dashed border-[color:var(--border)] px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
          Nothing recorded yet.
        </div>
      )}

      <label className="mt-4 grid gap-2">
        <span className="text-sm font-medium text-[color:var(--foreground)]">
          Clean transcript
        </span>
        <textarea
          rows={6}
          value={editedTranscript}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Edit the transcript if needed."
          className="app-input"
        />
      </label>
    </section>
  );
}
