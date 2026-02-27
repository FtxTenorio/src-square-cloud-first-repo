"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../lib/api";

type ServerConfig = {
  guildId: string;
  modLogChannelId: string | null;
  xpEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  timezoneDefault: string | null;
  locale: string | null;
};

type Options = {
  timezones: { value: string; label: string }[];
  locales: { value: string; label: string }[];
};

type DiscordGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
};

export default function ServerConfigClient() {
  const base = getApiUrl();
  const [guildId, setGuildId] = useState("");
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);

  const [form, setForm] = useState<Partial<ServerConfig>>({
    modLogChannelId: "",
    xpEnabled: true,
    rateLimitWindowMs: 60 * 1000,
    rateLimitMax: 10,
    timezoneDefault: "",
    locale: "",
  });

  const fetchOptions = async () => {
    try {
      const res = await fetch(`${base}/settings/options`);
      const json = await res.json();
      if (res.ok && json.data) setOptions(json.data);
    } catch {
      setOptions(null);
    }
  };

  const fetchGuilds = async () => {
    setLoadingGuilds(true);
    try {
      const res = await fetch(`${base}/settings/discord/guilds`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar servidores");
      setGuilds(json.data ?? []);
    } catch {
      setGuilds([]);
    } finally {
      setLoadingGuilds(false);
    }
  };

  const loadConfig = async () => {
    if (!guildId.trim()) {
      setError("Informe o Guild ID.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/settings/server?guildId=${encodeURIComponent(guildId.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar");
      const data = json.data || {};
      setConfig(data);
      setForm({
        modLogChannelId: data.modLogChannelId ?? "",
        xpEnabled: data.xpEnabled !== false,
        rateLimitWindowMs: data.rateLimitWindowMs ?? 60 * 1000,
        rateLimitMax: data.rateLimitMax ?? 10,
        timezoneDefault: data.timezoneDefault ?? "",
        locale: data.locale ?? "",
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
    if (!guildId.trim()) {
      setError("Informe o Guild ID.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const res = await fetch(`${base}/settings/server`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          guildId: guildId.trim(),
          modLogChannelId: form.modLogChannelId?.trim() || null,
          xpEnabled: form.xpEnabled,
          rateLimitWindowMs: form.rateLimitWindowMs ?? 60 * 1000,
          rateLimitMax: form.rateLimitMax ?? 10,
          timezoneDefault: form.timezoneDefault?.trim() || null,
          locale: form.locale?.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setConfig(json.data);
      setMessage("Configurações do servidor salvas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchOptions();
    fetchGuilds();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Configurações do servidor</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Configurações por guild (servidor Discord). Cada servidor pode ter comportamento diferente para XP, limite de uso e fuso.
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

      <div className="max-w-lg space-y-4 mb-8">
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">
                {loadingGuilds
                  ? "Carregando servidores…"
                  : guilds.length === 0
                  ? "Nenhum servidor encontrado"
                  : "Selecione um servidor"}
              </option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.id})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadConfig}
              disabled={loading || !guildId.trim()}
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
            >
              {loading ? "Carregando…" : "Carregar"}
            </button>
          </div>
          <input
            type="text"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            placeholder="Ou digite o Guild ID manualmente"
            className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-[11px] text-zinc-500">
            Use o seletor ou o ID manual para escolher qual servidor terá as configurações abaixo aplicadas.
          </p>
        </div>
      </div>

      {(config || form.modLogChannelId !== undefined) && (
        <form onSubmit={saveConfig} className="max-w-lg space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
              Canal de moderação (ID)
            </label>
            <p className="text-[11px] text-zinc-500 mb-1">
              ID do canal onde logs de moderação e alertas podem ser enviados pelo bot.
            </p>
            <input
              type="text"
              value={form.modLogChannelId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, modLogChannelId: e.target.value }))}
              placeholder="123456789012345678"
              className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.xpEnabled ?? true}
                onChange={(e) => setForm((f) => ({ ...f, xpEnabled: e.target.checked }))}
                className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
              />
              XP / níveis habilitados
            </label>
            <p className="text-[11px] text-zinc-500 mt-1">
              Quando desmarcado, o servidor não ganhará XP ou níveis, mesmo que a funcionalidade global esteja ativa.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
                Janela do rate limit (ms)
              </label>
              <p className="text-[11px] text-zinc-500 mb-1">
                Período de tempo (em milissegundos) considerado para limitar quantas ações podem ocorrer.
              </p>
              <input
                type="number"
                value={form.rateLimitWindowMs ?? 60000}
                onChange={(e) => setForm((f) => ({ ...f, rateLimitWindowMs: Number(e.target.value) || 60000 }))}
                min={1000}
                step={1000}
                className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
                Máx. requests na janela
              </label>
              <p className="text-[11px] text-zinc-500 mb-1">
                Quantidade máxima de comandos/requests permitidos dentro da janela configurada acima.
              </p>
              <input
                type="number"
                value={form.rateLimitMax ?? 10}
                onChange={(e) => setForm((f) => ({ ...f, rateLimitMax: Number(e.target.value) || 10 }))}
                min={1}
                className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
              Fuso horário padrão do servidor
            </label>
            <p className="text-[11px] text-zinc-500 mb-1">
              Usado como padrão quando o usuário não tiver um fuso salvo nas próprias preferências.
            </p>
            <select
              value={form.timezoneDefault ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, timezoneDefault: e.target.value || null }))}
              className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">— Nenhum —</option>
              {(options?.timezones ?? []).map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
              Locale padrão
            </label>
            <p className="text-[11px] text-zinc-500 mb-1">
              Idioma/região padrão para mensagens e formatos quando não for possível inferir do Discord.
            </p>
            <select
              value={form.locale ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value || null }))}
              className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">— Nenhum —</option>
              {(options?.locales ?? []).map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar configurações do servidor"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
