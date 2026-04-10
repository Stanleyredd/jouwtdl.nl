"use client";

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--border)]">
      <div className="mx-auto flex w-full max-w-[1260px] flex-col items-center justify-center gap-1 px-4 py-5 text-center text-xs leading-5 text-[color:var(--muted)] sm:px-6 lg:px-8">
        <p>© 2026 jouwtdl. All rights reserved.</p>
        <p>
          Made by{" "}
          <a
            href="https://kiralyai.com/"
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-200 hover:text-[color:var(--foreground)]"
          >
            KiralyAI
          </a>{" "}
          – AI solutions for businesses
        </p>
      </div>
    </footer>
  );
}
