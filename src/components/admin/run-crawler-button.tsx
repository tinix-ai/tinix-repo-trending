"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { triggerCrawlerSync } from "@/app/actions";

export function RunCrawlerButton({ source }: { source: 'github' | 'huggingface' }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success'>('idle');

  const handleRun = async () => {
    setStatus('running');
    await triggerCrawlerSync(source);
    setStatus('success');
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <button 
      onClick={handleRun}
      disabled={status === 'running'}
      className="apple-btn-secondary py-2 px-4 text-[13px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-[110px] justify-center transition-all duration-300"
    >
      {status === 'running' ? (
        <><RefreshCw className="w-3 h-3 animate-spin" /> Running...</>
      ) : status === 'success' ? (
        <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Success</>
      ) : (
        <><RefreshCw className="w-3 h-3" /> Run Now</>
      )}
    </button>
  );
}
