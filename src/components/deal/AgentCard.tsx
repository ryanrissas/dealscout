"use client";

import { useState } from "react";
import { Phone, Mail, Copy, Check, Building2 } from "lucide-react";

interface AgentInfo {
  fullName: string; brokerage: string;
  phone: string | null; email: string | null;
  officePhone: string | null; mlsAgentId: string | null;
  sourceUpdatedAt: string | null;
}

export default function AgentCard({ agent, sourceName }: { agent: AgentInfo | null; sourceName: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }
  return (
    <section className="card overflow-hidden border-blue/40">
      <div className="bg-blue px-4 py-2.5 text-white">
        <div className="eyebrow text-white/70">Listing agent</div>
      </div>
      <div className="p-4">
        {!agent ? (
          <p className="text-sm text-ink-faint">No agent contact was provided by the listing source. Contact data is never invented — check the listing page directly.</p>
        ) : (
          <>
            <div className="text-lg font-semibold">{agent.fullName}</div>
            <div className="flex items-center gap-1.5 text-sm text-ink-faint">
              <Building2 size={13} /> {agent.brokerage}
              {agent.mlsAgentId && <span className="mono text-xs">· {agent.mlsAgentId}</span>}
            </div>
            <div className="mt-3 space-y-2">
              {agent.phone ? (
                <div className="flex items-center gap-2">
                  <a href={`tel:${agent.phone.replace(/[^+\d]/g, "")}`} className="btn-primary flex-1 justify-center no-underline">
                    <Phone size={14} /> {agent.phone}
                  </a>
                  <button className="btn-ghost px-2" onClick={() => copy(agent.phone!, "phone")} aria-label="Copy phone number">
                    {copied === "phone" ? <Check size={14} className="text-deal-green" /> : <Copy size={14} />}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-ink-faint">Direct phone: not provided</div>
              )}
              {agent.email ? (
                <div className="flex items-center gap-2">
                  <a href={`mailto:${agent.email}`} className="btn-ghost flex-1 justify-center truncate no-underline">
                    <Mail size={14} /> <span className="truncate">{agent.email}</span>
                  </a>
                  <button className="btn-ghost px-2" onClick={() => copy(agent.email!, "email")} aria-label="Copy email">
                    {copied === "email" ? <Check size={14} className="text-deal-green" /> : <Copy size={14} />}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-ink-faint">Email: not provided</div>
              )}
              {agent.officePhone && (
                <div className="text-sm text-ink-faint">Office: <span className="mono">{agent.officePhone}</span></div>
              )}
            </div>
            <p className="mt-3 border-t border-hairline pt-2 text-xs text-ink-faint">
              Contact from {sourceName ?? "listing source"}
              {agent.sourceUpdatedAt && <> · as of {new Date(agent.sourceUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
