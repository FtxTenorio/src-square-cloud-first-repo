"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../lib/api";

type AdminConfig = {
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  features: {
    ai: boolean;
    levels: boolean;
    moderation: boolean;
    routines: boolean;
  };
};

type Options = {
  aiModels: { value: string; label: string }[];
};

export default function AdminConfigClient() {
  const base = getApiUrl();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState<AdminConfig>({
    aiModel: "gpt-3.5-turbo",
    aiTemperature: 0.8,
    aiMaxTokens: 500,
    features: { ai: true, levels: true, moderation: true, routines: true },
  });

  const loadOptions = async () => {
    try {
      const res = await fetch(`${base}/settings/options`);
      const json = await res.json();
      if (res.ok && json.data) setOptions(json.data);
    } catch {
      setOptions(null);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/settings/admin`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar");
      const data = json.data || {};
      setConfig(data);
      setForm({
        aiModel: data.aiModel ?? "gpt-3.5-turbo",
        aiTemperature: data.aiTemperature ?? 0.8,
        aiMaxTokens: data.aiMaxTokens ?? 500,
        features: {
          ai: data.features?.ai !== false,
          levels: data.features?.levels !== false,
          moderation: data.features?.moderation !== false,
          routines: data.features?.routines !== false,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${base}/settings/admin`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aiModel: form.aiModel,
          aiTemperature: form.aiTemperature,
          aiMaxTokens: form.aiMaxTokens,
          features: form.features,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setConfig(json.data);
      setMessage("Configurações salvas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadOptions();
    loadConfig();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Configurações globais</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Definições padrão da IA e ativação de funcionalidades (AI, níveis, moderação, rotinas) para todo o bot.
        Estas opções impactam todos os servidores onde o bot está presente.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-red-300 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-emerald-300 text-sm">
          {message}
        </div>
      )}

      {config ? (
        <form onSubmit={saveConfig} className="max-w-lg space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">IA (OpenAI)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
                  Modelo
                </label>
                <p className="text-[11px] text-zinc-500 mb-1">
                  Escolha qual modelo de linguagem será usado pelas features de IA do bot.
                </p>
                <select
                  value={form.aiModel}
                  onChange={(e) => setForm((f) => ({ ...f, aiModel: e.target.value }))}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {(options?.aiModels ?? []).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
                    Temperatura (0–2)
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-1">
                    Valores menores deixam a resposta mais previsível; valores maiores, mais criativos e variadas.
                  </p>
                  <input
                    type="number"
                    value={form.aiTemperature}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, aiTemperature: Number(e.target.value) || 0.8 }))
                    }
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
                    Max tokens
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-1">
                    Limite máximo de tokens por resposta. Valores maiores permitem respostas mais longas, mas custam mais.
                  </p>
                  <input
                    type="number"
                    value={form.aiMaxTokens}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, aiMaxTokens: Number(e.target.value) || 500 }))
                    }
                    min={1}
                    max={4096}
                    className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Funcionalidades</h2>
            <p className="text-[11px] text-zinc-500 mb-2">
              Ative ou desative módulos inteiros do bot. Mesmo ativados aqui, cada servidor ainda pode ter controles próprios.
            </p>
            <div className="space-y-2">
              {(
                [
                  { key: "ai" as const, label: "IA / chat" },
                  { key: "levels" as const, label: "XP e níveis" },
                  { key: "moderation" as const, label: "Moderação" },
                  { key: "routines" as const, label: "Rotinas (Life-Sync)" },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={form.features[key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        features: { ...f.features, [key]: e.target.checked },
                      }))
                    }
                    className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-zinc-500 text-sm">Carregando configurações globais…</p>
      )}
    </div>
  );
}
