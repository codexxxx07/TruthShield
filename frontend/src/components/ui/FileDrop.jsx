import { useEffect, useRef, useState } from 'react';
import { FiImage, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { cn } from '../../lib/utils';

export default function FileDrop({
  file,
  onFile,
  onClear,
  accept = 'image/png,image/jpeg,image/webp',
  error,
  hint = 'PNG, JPG or WebP · up to 5 MB',
  label = 'Drop a screenshot here, or browse',
  className,
}) {
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Revoke the last object URL when the control unmounts.
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const revokePreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
  };

  const handleFiles = (fileList) => {
    const next = fileList?.[0];
    if (!next) return;
    revokePreview();
    if (next.type?.startsWith('image/')) {
      const url = URL.createObjectURL(next);
      previewRef.current = url;
      setPreviewUrl(url);
    }
    onFile(next);
  };

  const clear = () => {
    revokePreview();
    if (inputRef.current) inputRef.current.value = '';
    onClear?.();
  };

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors',
          dragging ? 'border-brand bg-brand/5' : 'border-line-strong bg-surface-2/50',
          error && 'border-critical/60 bg-critical/5',
        )}
      >
        {file ? (
          <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:text-left">
            {previewUrl ? (
              <img src={previewUrl} alt={`Preview of ${file.name}`} className="h-20 w-32 rounded-lg border border-line object-cover" />
            ) : (
              <span className="grid h-20 w-32 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-3">
                <FiImage className="text-xl" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-ink">{file.name}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">{(file.size / 1024).toFixed(0)} KB · attached</p>
              <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:text-ink"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex items-center gap-1 rounded-md border border-critical/25 bg-critical/5 px-2 py-1 text-[11px] font-medium text-critical transition hover:bg-critical/10"
                >
                  <FiTrash2 className="text-[11px]" aria-hidden="true" /> Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink-3">
              {dragging ? <FiUploadCloud className="text-lg" aria-hidden="true" /> : <FiImage className="text-lg" aria-hidden="true" />}
            </span>
            <button type="button" onClick={() => inputRef.current?.click()} className="text-[12.5px] font-medium text-ink transition hover:text-brand">
              {label}
            </button>
            <p className="text-[11.5px] text-ink-3">{hint}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {error ? <p className="mt-1.5 text-[12px] text-critical">{error}</p> : null}
    </div>
  );
}
