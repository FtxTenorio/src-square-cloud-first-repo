"use client";

import { useState, useEffect } from "react";

type PencilEditInputProps = {
  value: string;
  onConfirm: (newValue: string) => void | Promise<void>;
  onCancel?: () => void;
  label: string;
  placeholder?: string;
  maxLength: number;
  /** Optional class for the input (e.g. font-mono for name) */
  inputClassName?: string;
};

export default function PencilEditInput({
  value,
  onConfirm,
  onCancel,
  label,
  placeholder = "",
  maxLength,
  inputClassName = "",
}: PencilEditInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleCancel = () => {
    setLocalValue(value);
    setIsEditing(false);
    onCancel?.();
  };

  const handleConfirm = async () => {
    if (localValue === value) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onConfirm(localValue);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-zinc-500 text-xs uppercase tracking-wider">{label}</span>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            title={`Editar ${label.toLowerCase()}`}
            aria-label={`Editar ${label.toLowerCase()}`}
          >
            <PencilIcon />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50"
              title="Cancelar"
              aria-label="Cancelar"
            >
              <XIcon />
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="rounded p-1.5 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              title="Confirmar"
              aria-label="Confirmar"
            >
              <CheckIcon />
            </button>
          </div>
        )}
      </div>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        disabled={!isEditing}
        maxLength={maxLength}
        placeholder={placeholder}
        className={
          "w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-default disabled:opacity-90 " +
          inputClassName
        }
      />
      <p className="mt-1 text-xs text-zinc-500">
        {localValue.length}/{maxLength}
      </p>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
