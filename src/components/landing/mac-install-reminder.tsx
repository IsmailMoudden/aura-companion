import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

export const MAC_INSTALL_COMMAND = 'xattr -dr com.apple.quarantine "/Applications/Aura.app"';

export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };
  return (
    <div className="mt-3 min-w-0 rounded-xl border border-white/10 bg-black/25 p-3">
      {command === MAC_INSTALL_COMMAND && (
        <div className="mb-3 text-xs leading-relaxed text-foreground/75">
          <p className="mb-1 font-medium text-foreground/95">Why this command?</p>
          <p>Aura’s early-access build does not yet have a Developer ID signature or Apple notarization, so macOS may block its first launch.</p>
          <p className="mt-2">This removes the download-quarantine flag from Aura only. It downloads nothing and keeps Gatekeeper enabled for other apps.</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-foreground/90 underline underline-offset-4">What exactly changes?</summary>
            <p className="mt-2">macOS’s built-in <code>xattr</code> tool removes <code>com.apple.quarantine</code> from <code>/Applications/Aura.app</code> and its bundled files. Removing this flag bypasses the download-related first-launch check for this copy. It is not an Apple approval or a security scan.</p>
            <a href="https://github.com/IsmailMoudden/aura-companion" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline underline-offset-4">View Aura’s source and releases on GitHub</a>
          </details>
        </div>
      )}
      <code className="block break-all font-mono text-xs leading-relaxed text-foreground/90 select-all">{command}</code>
      <button type="button" onClick={copy} className="mt-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-foreground transition-colors hover:bg-white/20">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy command"}
      </button>
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        {copyFailed ? "Copy is unavailable. Select the command above and copy it manually." : copied ? "Paste into Terminal, then press Return." : ""}
      </p>
    </div>
  );
}

export function MacInstallReminder() {
  return (
    <section aria-labelledby="mac-install-title" className="mb-5 rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.06] p-4">
      <div className="mb-2 flex items-center gap-2 text-cyan-100">
        <Terminal className="h-4 w-4 shrink-0" />
        <h3 id="mac-install-title" className="text-sm font-medium">After installing, before opening Aura</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground" role="status">Keep this guide open while you install Aura.</p>
      <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-foreground/85">
        <li>Open the downloaded .dmg and drag <strong>Aura into Applications</strong>.</li>
        <li>If macOS blocks Aura, open <strong>Terminal</strong> using Spotlight (⌘ Space), paste this command and press Return:
          <InstallCommand command={MAC_INSTALL_COMMAND} />
        </li>
        <li>Open Aura from Applications.</li>
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Only use this for the Aura download you trust. Prefer not to use Terminal? If macOS offers it, use <strong>System Settings → Privacy &amp; Security → Open Anyway</strong>. <a href="https://support.apple.com/en-us/102445" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Apple’s guide</a></p>
    </section>
  );
}
