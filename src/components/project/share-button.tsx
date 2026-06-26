'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, X, Twitter, Linkedin, Facebook, MessageCircle, Link, BarChart2 } from 'lucide-react';

interface ShareButtonProps {
  projectId: string;
  projectName: string;
  projectDescription?: string | null;
}

interface ShareData {
  code: string;
  shortUrl: string;
  ogImageUrl: string;
}

const PLATFORM_CONFIGS = [
  {
    key: 'twitter',
    label: 'X / Twitter',
    icon: Twitter,
    color: '#000000',
    bg: 'rgba(0,0,0,0.1)',
    buildUrl: (url: string, name: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🚀 Check out ${name} — an open source project worth following!\n\n${url}\n\n#opensource #ai #github`)}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    color: '#0A66C2',
    bg: 'rgba(10,102,194,0.1)',
    buildUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    color: '#1877F2',
    bg: 'rgba(24,119,242,0.1)',
    buildUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'reddit',
    label: 'Reddit',
    icon: MessageCircle,
    color: '#FF4500',
    bg: 'rgba(255,69,0,0.1)',
    buildUrl: (url: string, name: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(`${name} — Trending Open Source Project`)}`,
  },
];

export function ShareButton({ projectId, projectName, projectDescription }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleOpen = async () => {
    if (!isOpen) {
      setIsOpen(true);
      if (!shareData) {
        setIsLoading(true);
        try {
          const res = await fetch('/api/share/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
          });
          if (res.ok) {
            const data = await res.json();
            setShareData(data);
          }
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      setIsOpen(false);
    }
  };

  const handleCopy = async () => {
    if (!shareData?.shortUrl) return;
    await navigator.clipboard.writeText(shareData.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlatformShare = (platform: typeof PLATFORM_CONFIGS[0]) => {
    if (!shareData?.shortUrl) return;
    const url = platform.buildUrl(shareData.shortUrl, projectName);
    window.open(url, '_blank', 'width=600,height=500,noopener');
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Share Button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        title="Share this project"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(99,102,241,0.4)',
          background: isOpen
            ? 'rgba(99,102,241,0.15)'
            : 'rgba(99,102,241,0.08)',
          color: '#a5b4fc',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.2)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.6)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.4)';
          }
        }}
      >
        <Share2 size={15} />
        Share
      </button>

      {/* Share Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '320px',
            background: 'var(--card-bg, #1a1a2e)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
            zIndex: 1000,
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
            animation: 'sharePopIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <style>{`
            @keyframes sharePopIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 16px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={15} color="#a5b4fc" />
              <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                Share Project
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '4px',
                display: 'flex',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Short URL section */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Short Link
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <Link size={13} color="rgba(255,255,255,0.4)" />
              <span
                style={{
                  flex: 1,
                  fontSize: '13px',
                  color: isLoading ? 'rgba(255,255,255,0.3)' : '#a5b4fc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace',
                }}
              >
                {isLoading ? 'Generating link…' : shareData?.shortUrl || '—'}
              </span>
              <button
                onClick={handleCopy}
                disabled={isLoading || !shareData}
                title="Copy link"
                style={{
                  background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.2)',
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
                  borderRadius: '6px',
                  color: copied ? '#86efac' : '#a5b4fc',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Platform share buttons */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Share to
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PLATFORM_CONFIGS.map((platform) => {
                const Icon = platform.icon;
                return (
                  <button
                    key={platform.key}
                    onClick={() => handlePlatformShare(platform)}
                    disabled={isLoading || !shareData}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: platform.bg,
                      border: `1px solid ${platform.color}33`,
                      color: platform.color,
                      cursor: isLoading || !shareData ? 'not-allowed' : 'pointer',
                      opacity: isLoading || !shareData ? 0.5 : 1,
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.15s',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading && shareData) {
                        (e.currentTarget as HTMLButtonElement).style.background = `${platform.color}22`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = platform.bg;
                    }}
                  >
                    <Icon size={14} />
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OG Preview hint */}
          {shareData && (
            <div
              style={{
                margin: '0 16px 14px',
                padding: '10px 12px',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <BarChart2 size={14} color="#a5b4fc" style={{ marginTop: '1px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: '500', marginBottom: '2px' }}>
                  Rich Preview
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                  Link includes thumbnail & stats — looks great on social media.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
