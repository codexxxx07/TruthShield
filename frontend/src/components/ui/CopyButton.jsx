import { useEffect, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { cn, copyToClipboard } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';

export default function CopyButton({ value, label = 'Copy', className, compact = false }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      toast.success('Copied to clipboard');
    } else {
      toast.error('Clipboard unavailable', 'Your browser blocked clipboard access.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:border-brand/40 hover:text-neon',
        className,
      )}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? <FiCheck className="text-[12px] text-safe" aria-hidden="true" /> : <FiCopy className="text-[12px]" aria-hidden="true" />}
      {!compact ? <span>{copied ? 'Copied' : label}</span> : null}
    </button>
  );
}
