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
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground" role="status">Your download is starting. Keep these instructions for the first launch.</p>
      <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-foreground/85">
        <li>Open the downloaded .dmg and drag <strong>Aura into Applications</strong>.</li>
        <li>If macOS blocks Aura, open <strong>Terminal</strong> using Spotlight (⌘ Space), paste this command and press Return:
          <InstallCommand command={MAC_INSTALL_COMMAND} />
        </li>
        <li>Open Aura from Applications.</li>
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">This beta is not signed yet. The command removes the download quarantine from Aura only. Use it for the copy downloaded from this site.</p>
    </section>
  );
}
