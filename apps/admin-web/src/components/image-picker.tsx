'use client';

// ─── Image Picker ─────────────────────────────────────────────
// Drag-and-drop / click-to-browse image uploader that:
//  1. Gets a presigned PUT URL from the admin API
//  2. Uploads the image directly to R2
//  3. Returns the CDN URL to the parent via onChange()
//
// Usage:
//   <ImagePicker value={imageUrl} onChange={setImageUrl} />

import { useState, useRef, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { ImagePlus, X, Loader2 } from 'lucide-react';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

interface ImagePickerProps {
  /** Current image URL (CDN URL from R2). */
  value?: string | null;
  /** Called when the image changes. null = removed. */
  onChange: (url: string | null) => void;
  /** Optional label override. Default: "Question Image" */
  label?: string;
  /** Compact mode — smaller height. */
  compact?: boolean;
}

export function ImagePicker({ value, onChange, label = 'Question Image', compact }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [error, setError]         = useState('');

  const upload = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Image must be under 5 MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      // 1. Get presigned URL
      const res = await adminApi.post<{ data: { uploadUrl: string; cdnUrl: string } }>(
        '/api/admin/upload/presign',
        { mimeType: file.type },
      );
      const { uploadUrl, cdnUrl } = res.data.data;

      // 2. PUT to R2 directly
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);

      // 3. Return CDN URL to parent
      onChange(cdnUrl);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Upload failed.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  // ── Has image → show preview ──────────────────────────────
  if (value) {
    return (
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
        <div className="relative inline-block group">
          <img
            src={value}
            alt="Uploaded"
            className={`rounded-xl border border-zinc-700 object-cover ${compact ? 'h-20' : 'h-32'} max-w-full`}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg transition opacity-0 group-hover:opacity-100"
            title="Remove image"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  // ── No image → drop zone ──────────────────────────────────
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed
          transition-all duration-200
          ${compact ? 'py-3 px-4' : 'py-5 px-4'}
          ${dragOver
            ? 'border-violet-500 bg-violet-600/10'
            : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600 hover:bg-zinc-800/60'
          }
          ${uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
        `}
      >
        {uploading ? (
          <>
            <Loader2 size={18} className="text-violet-400 animate-spin" />
            <span className="text-xs text-zinc-400">Uploading…</span>
          </>
        ) : (
          <>
            <ImagePlus size={18} className={dragOver ? 'text-violet-400' : 'text-zinc-500'} />
            <span className="text-xs text-zinc-500">
              Click or drag an image here
            </span>
            <span className="text-[10px] text-zinc-600">JPEG, PNG, WebP · Max 5 MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={handleFile}
      />
      {error && (
        <p className="text-xs text-red-400 mt-1.5">{error}</p>
      )}
    </div>
  );
}
