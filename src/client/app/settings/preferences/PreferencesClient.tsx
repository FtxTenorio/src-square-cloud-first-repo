"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../lib/api";

type Options = {
  timezones: { value: string; label: string }[];
  locales?: { value: string; label: string }[];
};

type DiscordGuild = {
  id: string;
  name: string;
};

type DiscordMember = {
  id: string;
  username: string;
  displayName: string;
};

export default function PreferencesClient() {
  const base = getApiUrl();
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [timezone, setTimezone] = useState("");
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [members, setMembers] = useState<DiscordMember[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

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

  const fetchMembers = async (guild: string) => {
    if (!guild.trim()) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    try {
      const params = new URLSearchParams({ guildId: guild.trim() });
      const res = await fetch(`${base}/settings/discord/guild-members?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar membros");
      setMembers(json.data ?? []);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadPreferences = async (targetUserId?: string) => {
    const id = (targetUserId ?? userId).trim();
    if (!id) {
      setError("Informe seu Discord User ID para carregar as preferências.");
      return;
    }
    setUserId(id);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${base}/user-preferences/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar");
      const data = json.data || {};
      setTimezone(data.timezone ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
      setTimezone("");
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError("Informe seu Discord User ID.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${base}/user-preferences/${encodeURIComponent(userId.trim())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: timezone || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setMessage("Preferências salvas.");
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

  useEffect(() => {
    if (guildId.trim()) {
      fetchMembers(guildId);
    } else {
      setMembers([]);
    }
  }, [guildId]);

  useEffect(() => {
    if (!guildId && guilds.length > 0) {
      setGuildId(guilds[0].id);
    }
  }, [guilds, guildId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Minhas preferências</h1>
      <p className="text-zinc-400 text-sm mb-2">
        Configurações por usuário (por Discord User ID). Em produção, o acesso pode ser validado por login.
      </p>
      <p className="text-zinc-500 text-xs mb-6">
        Para facilitar, você pode escolher o servidor/usuário em dropdowns, em vez de colar o ID manualmente.
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

      <form onSubmit={savePreferences} className="max-w-md space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Servidor (guild)
            </label>
            <p className="text-[11px] text-zinc-500">
              Escolha em qual servidor o bot está para ver os usuários disponíveis.
            </p>
            <select
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">
                {loadingGuilds
                  ? "Carregando servidores…"
                  : guilds.length === 0
                  ? "Nenhum servidor encontrado"
                  : "Selecione um servidor (opcional)"}
              </option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.id})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Usuário (dropdown opcional)
            </label>
            <p className="text-[11px] text-zinc-500">
              Use este select para preencher rapidamente o usuário, se preferir não clicar nos cards.
            </p>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={!guildId || members.length === 0}
              className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">
                {!guildId
                  ? "Selecione um servidor para listar usuários"
                  : loadingMembers
                  ? "Carregando usuários…"
                  : members.length === 0
                  ? "Nenhum usuário carregado"
                  : "Selecione um usuário (opcional)"}
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.username})
                </option>
              ))}
            </select>
          </div>
          {guildId && members.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
                Usuários deste servidor
              </p>
              <p className="text-[11px] text-zinc-500 mb-2">
                Clique em um usuário para carregar e editar as preferências dele.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => loadPreferences(m.id)}
                    className="flex flex-col items-start rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-left hover:border-indigo-500 hover:bg-zinc-800/80"
                  >
                    <span className="text-sm font-medium text-zinc-100">
                      {m.displayName}
                    </span>
                    <span className="text-xs text-zinc-400">@{m.username}</span>
                    <span className="mt-1 text-[10px] font-mono text-zinc-500 break-all">
                      {m.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
              Discord User ID (pode ser preenchido via dropdown)
            </label>
            <p className="text-[11px] text-zinc-500 mb-1">
              Caso já saiba o ID, cole diretamente aqui; caso contrário, escolha um usuário acima para preencher.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="123456789012345678"
                className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => loadPreferences()}
                disabled={loading || !userId.trim()}
                className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
              >
                {loading ? "Carregando…" : "Carregar"}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
            Fuso horário (para rotinas)
          </label>
          <p className="text-[11px] text-zinc-500 mb-1">
            Define o fuso utilizado ao criar e disparar as suas rotinas pessoais.
          </p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— Padrão —</option>
            {(options?.timezones ?? []).map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !userId.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar preferências"}
          </button>
          {!saving && (
            <p className="text-[11px] text-zinc-500 self-center">
              Salva apenas as preferências deste usuário (não altera configurações do servidor).
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
