"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../lib/api";

type Command = {
  _id?: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  guildId?: string | null;
  deployment?: { status: string; lastDeployed?: string };
  stats?: { totalUses?: number };
};

type Stats = {
  total?: number;
  enabled?: number;
  byCategory?: Record<string, number>;
};

type RateLimitEntry = {
  action: string;
  count: number;
  remaining: number;
  resetIn: number;
  blocked?: boolean;
};

type RateLimit = {
  maxAttempts: number;
  windowSeconds: number;
  active: RateLimitEntry[];
};

export default function CommandsClient() {
  const base = getApiUrl();
  const [commands, setCommands] = useState<Command[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterEnabled, setFilterEnabled] = useState<string>("");
  const [scope, setScope] = useState<"global" | "guild">("global");
  const [guildId, setGuildId] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<{ success: boolean; maxAttempts: number; windowSeconds: number; active: RateLimitEntry[] } | null>(null);
  const [detailCommand, setDetailCommand] = useState<Command | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const scopeGuildId = scope === "global" ? null : guildId || null;

  const fetchCommands = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterEnabled === "true") params.set("enabled", "true");
      if (filterEnabled === "false") params.set("enabled", "false");
      if (scope === "global") params.set("guildId", "global");
      else if (guildId) params.set("guildId", guildId);
      const res = await fetch(`${base}/commands?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
      setCommands(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load commands");
      setCommands([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${base}/commands/stats`);
      const json = await res.json();
      if (res.ok && json.data) setStats(json.data);
    } catch {
      setStats(null);
    }
  };

  const fetchRateLimit = async () => {
    try {
      const res = await fetch(`${base}/commands/rate-limit`);
      const json = await res.json();
      if (res.ok && json.success) setRateLimit(json);
    } catch {
      setRateLimit(null);
    }
  };

  const openCommandDetail = async (name: string) => {
    setDetailCommand(null);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      if (scope === "global") params.set("guildId", "global");
      else if (guildId) params.set("guildId", guildId);
      const res = await fetch(`${base}/commands/${encodeURIComponent(name)}?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setDetailCommand(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load command");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, [filterCategory, filterEnabled, scope, guildId]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchRateLimit();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const body = scope === "guild" && guildId ? JSON.stringify({ guildId }) : "{}";
      const res = await fetch(`${base}/commands/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      await fetchCommands();
      await fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeploy = async () => {
    if (scope === "guild" && !guildId.trim()) {
      setError("Informe o ID do servidor (guild) para deploy em guild.");
      return;
    }
    setDeploying(true);
    try {
      const body = scope === "guild" && guildId ? JSON.stringify({ guildId }) : "{}";
      const res = await fetch(`${base}/commands/deploy`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Deploy failed");
      await fetchCommands();
      await fetchStats();
      await fetchRateLimit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const toggleCommand = async (name: string, enabled: boolean) => {
    setActionLoading(name);
    try {
      const body: { enabled: boolean; guildId?: string | null } = { enabled };
      if (scopeGuildId !== undefined) body.guildId = scopeGuildId;
      const res = await fetch(`${base}/commands/${encodeURIComponent(name)}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Toggle failed");
      await fetchCommands();
      await fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteCommand = async (name: string) => {
    if (!confirm(`Deletar o comando "${name}" do banco de dados?`)) return;
    const alsoFromDiscord = confirm("Também remover o comando do Discord? (o slash command deixará de aparecer para os usuários)");
    setActionLoading(name);
    try {
      if (alsoFromDiscord) {
        const discordOpts: RequestInit = {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: scopeGuildId !== undefined && scopeGuildId !== null ? JSON.stringify({ guildId: scopeGuildId }) : undefined,
        };
        const discordRes = await fetch(`${base}/commands/${encodeURIComponent(name)}/discord`, discordOpts);
        const discordJson = await discordRes.json();
        if (!discordRes.ok && discordRes.status !== 404) {
          throw new Error(discordJson.error ?? "Falha ao remover do Discord");
        }
      }
      const opts: RequestInit = { method: "DELETE", headers: { "Content-Type": "application/json" } };
      if (scopeGuildId !== undefined && scopeGuildId !== null) opts.body = JSON.stringify({ guildId: scopeGuildId });
      const res = await fetch(`${base}/commands/${encodeURIComponent(name)}`, opts);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      await fetchCommands();
      await fetchStats();
      if (detailCommand?.name === name) setDetailCommand(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const categories = ["utility", "moderation", "fun", "ai", "custom", "system"];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Commands</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 min-w-[120px]">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Total</p>
          <p className="text-xl font-semibold text-white">{stats?.total ?? commands.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 min-w-[120px]">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Enabled</p>
          <p className="text-xl font-semibold text-emerald-400">{stats?.enabled ?? commands.filter((c) => c.enabled).length}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {rateLimit?.active && (() => {
            const deployEntry = rateLimit.active.find((e) => e.action.startsWith("deploy:"));
            const used = deployEntry?.count ?? 0;
            const max = rateLimit.maxAttempts;
            return (
              <span className="text-xs text-zinc-400 whitespace-nowrap" title="Deploys na última hora">
                {used}/{max} deploys (última hora)
              </span>
            );
          })()}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync from Discord"}
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {deploying ? "Deploying…" : "Deploy to Discord"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <span className="text-zinc-500 text-sm">Scope:</span>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "global" | "guild")}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="global">Global</option>
          <option value="guild">Guild (servidor)</option>
        </select>
        {scope === "guild" && (
          <input
            type="text"
            placeholder="Guild ID"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 w-56"
          />
        )}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterEnabled}
          onChange={(e) => setFilterEnabled(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading commands…</p>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/80 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Uses</th>
                <th className="px-4 py-3 font-medium w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {commands.map((cmd) => (
                <tr key={`${cmd.name}-${cmd.guildId ?? "global"}`} className="text-zinc-300">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openCommandDetail(cmd.name)}
                      className="font-mono text-white hover:text-indigo-300 hover:underline text-left"
                    >
                      {cmd.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{cmd.guildId ? `Guild ${cmd.guildId}` : "Global"}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{cmd.description}</td>
                  <td className="px-4 py-3">{cmd.category}</td>
                  <td className="px-4 py-3">
                    <span className={cmd.enabled ? "text-emerald-400" : "text-zinc-500"}>
                      {cmd.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {cmd.deployment?.status && (
                      <span className="ml-2 text-zinc-500">({cmd.deployment.status})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{cmd.stats?.totalUses ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleCommand(cmd.name, !cmd.enabled)}
                        disabled={actionLoading === cmd.name}
                        className="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600 disabled:opacity-50"
                      >
                        {cmd.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteCommand(cmd.name)}
                        disabled={actionLoading === cmd.name}
                        className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commands.length === 0 && (
            <p className="px-4 py-8 text-center text-zinc-500">No commands found.</p>
          )}
        </div>
      )}

      {(detailLoading || detailCommand) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !detailLoading && setDetailCommand(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="p-8 text-center text-zinc-400">Carregando…</div>
            ) : detailCommand ? (
              <>
                <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
                  <h2 className="text-lg font-semibold text-white font-mono">{detailCommand.name}</h2>
                  <button
                    type="button"
                    onClick={() => setDetailCommand(null)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                    aria-label="Fechar"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div>
                    <span className="text-zinc-500 block text-xs uppercase tracking-wider">Descrição</span>
                    <p className="text-zinc-200">{detailCommand.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-zinc-500 block text-xs uppercase tracking-wider">Categoria</span>
                      <p className="text-zinc-200">{detailCommand.category}</p>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-xs uppercase tracking-wider">Status</span>
                      <p className={detailCommand.enabled ? "text-emerald-400" : "text-zinc-500"}>
                        {detailCommand.enabled ? "Ativo" : "Desativado"}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-xs uppercase tracking-wider">Escopo</span>
                      <p className="text-zinc-200">{detailCommand.guildId ? `Guild ${detailCommand.guildId}` : "Global"}</p>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-xs uppercase tracking-wider">Uso total</span>
                      <p className="text-zinc-200">{detailCommand.stats?.totalUses ?? 0}</p>
                    </div>
                  </div>
                  {detailCommand.deployment && (
                    <div>
                      <span className="text-zinc-500 block text-xs uppercase tracking-wider">Deploy</span>
                      <p className="text-zinc-200">
                        {detailCommand.deployment.status}
                        {detailCommand.deployment.lastDeployed && ` · Último: ${detailCommand.deployment.lastDeployed}`}
                      </p>
                    </div>
                  )}
                  {"options" in detailCommand && Array.isArray((detailCommand as { options?: unknown[] }).options) && (detailCommand as { options: unknown[] }).options.length > 0 && (
                    <div>
                      <span className="text-zinc-500 block text-xs uppercase tracking-wider">Opções</span>
                      <pre className="mt-1 rounded bg-zinc-800 p-2 text-xs text-zinc-300 overflow-x-auto">
                        {JSON.stringify((detailCommand as { options: unknown[] }).options, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
