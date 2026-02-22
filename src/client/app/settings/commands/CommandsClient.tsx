"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../../../lib/api";
import PencilEditInput from "./PencilEditInput";

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

type OnlyOnDiscordItem = {
  id: string;
  name: string;
  description: string;
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ name: string } | null>(null);
  const [deleteAlsoDiscord, setDeleteAlsoDiscord] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalCategory, setOriginalCategory] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState("custom");
  const [createScope, setCreateScope] = useState<"global" | "guild">("global");
  const [createGuildId, setCreateGuildId] = useState("");
  const [createEnabled, setCreateEnabled] = useState(true);
  const [createSaving, setCreateSaving] = useState(false);
  const [onlyOnDiscord, setOnlyOnDiscord] = useState<OnlyOnDiscordItem[]>([]);
  const [deletedCommands, setDeletedCommands] = useState<Command[]>([]);

  const scopeGuildId = scope === "global" ? null : guildId || null;

  const ALLOWED_CATEGORIES = ["utility", "moderation", "fun", "ai", "custom", "system"] as const;

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
      setDeletedCommands(json.deleted ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load commands");
      setCommands([]);
      setDeletedCommands([]);
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

  useEffect(() => {
    if (detailCommand) {
      const name = detailCommand.name;
      const category = detailCommand.category || "custom";
      const description = detailCommand.description ?? "";
      setEditName(name);
      setEditCategory(category);
      setEditDescription(description);
      setOriginalName(name);
      setOriginalCategory(category);
      setOriginalDescription(description);
    }
  }, [detailCommand]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const body = scope === "guild" && guildId ? JSON.stringify({ guildId }) : "{}";
      const res = await fetch(`${base}/commands/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      setOnlyOnDiscord(json.onlyOnDiscord ?? []);
      await fetchCommands();
      await fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleRemoveOrphanFromDiscord = async (name: string) => {
    setActionLoading(`orphan-${name}`);
    try {
      const body = JSON.stringify({ name, guildId: scopeGuildId ?? undefined });
      const res = await fetch(`${base}/commands/remove-orphan-from-discord`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao remover");
      setOnlyOnDiscord((prev) => prev.filter((c) => c.name !== name));
      await fetchCommands();
      await fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover do Discord");
    } finally {
      setActionLoading(null);
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

  const confirmDelete = (name: string) => {
    setDeleteAlsoDiscord(false);
    setDeleteConfirm({ name });
  };

  const executeDelete = async (alsoFromDiscord: boolean) => {
    const name = deleteConfirm?.name;
    if (!name) return;
    setActionLoading(name);
    try {
      if (alsoFromDiscord) {
        const discordBody = scopeGuildId !== undefined && scopeGuildId !== null ? { guildId: scopeGuildId } : {};
        const discordOpts: RequestInit = {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordBody),
        };
        const discordRes = await fetch(`${base}/commands/${encodeURIComponent(name)}/discord`, discordOpts);
        const discordJson = await discordRes.json();
        if (!discordRes.ok && discordRes.status !== 404) {
          throw new Error(discordJson.error ?? "Falha ao remover do Discord");
        }
      }
      const deleteBody = scopeGuildId !== undefined && scopeGuildId !== null ? { guildId: scopeGuildId } : {};
      const opts: RequestInit = {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteBody),
      };
      const res = await fetch(`${base}/commands/${encodeURIComponent(name)}`, opts);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setDeleteConfirm(null);
      await fetchCommands();
      await fetchStats();
      if (detailCommand?.name === name) setDetailCommand(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const closeDeleteModal = () => {
    if (!actionLoading) setDeleteConfirm(null);
  };

  const hasDetailChange =
    editName.trim().toLowerCase() !== originalName ||
    editCategory !== originalCategory ||
    editDescription !== originalDescription;

  const confirmNameEdit = (newValue: string) => {
    const name = newValue.trim().toLowerCase();
    if (!name) {
      setError("Nome não pode ser vazio");
      throw new Error("Nome não pode ser vazio");
    }
    if (name.length > 32) {
      setError("Nome deve ter no máximo 32 caracteres");
      throw new Error("Nome deve ter no máximo 32 caracteres");
    }
    setError(null);
    setEditName(name);
    setOriginalName(name);
    setDetailCommand((prev) => (prev ? { ...prev, name } : null));
  };

  const confirmDescriptionEdit = async (newValue: string) => {
    if (!detailCommand) return;
    if (newValue === originalDescription) return;
    setError(null);
    try {
      const body: { description: string; guildId?: string | null } = { description: newValue };
      if (scopeGuildId !== undefined && scopeGuildId !== null) body.guildId = scopeGuildId;
      const res = await fetch(`${base}/commands/${encodeURIComponent(detailCommand.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar descrição");
      setEditDescription(newValue);
      setOriginalDescription(newValue);
      setDetailCommand({ ...detailCommand, description: newValue });
      await fetchCommands();
      await fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar descrição");
      throw e;
    }
  };

  const saveDetailCommand = async () => {
    if (!detailCommand || !hasDetailChange) return;
    const name = editName.trim().toLowerCase();
    if (!name) {
      setError("Nome não pode ser vazio");
      return;
    }
    if (name.length > 32) {
      setError("Nome deve ter no máximo 32 caracteres");
      return;
    }
    if (!ALLOWED_CATEGORIES.includes(editCategory as (typeof ALLOWED_CATEGORIES)[number])) {
      setError("Categoria inválida");
      return;
    }
    setDetailSaving(true);
    setError(null);
    try {
      const body: { name: string; category: string; description: string; guildId?: string | null } = {
        name,
        category: editCategory,
        description: editDescription,
      };
      if (scopeGuildId !== undefined && scopeGuildId !== null) body.guildId = scopeGuildId;
      const res = await fetch(`${base}/commands/${encodeURIComponent(detailCommand.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setDetailCommand({ ...detailCommand, ...json.data, name, category: editCategory, description: editDescription });
      setOriginalName(name);
      setOriginalCategory(editCategory);
      setOriginalDescription(editDescription);
      await fetchCommands();
      await fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setDetailSaving(false);
    }
  };

  const handleCreateCommand = async () => {
    const name = createName.trim().toLowerCase();
    if (!name) {
      setError("Nome é obrigatório");
      return;
    }
    if (name.length > 32) {
      setError("Nome deve ter no máximo 32 caracteres");
      return;
    }
    if (!createDescription.trim()) {
      setError("Descrição é obrigatória");
      return;
    }
    if (createDescription.length > 100) {
      setError("Descrição deve ter no máximo 100 caracteres");
      return;
    }
    if (createScope === "guild" && !createGuildId.trim()) {
      setError("Informe o Guild ID para comando de servidor");
      return;
    }
    if (!ALLOWED_CATEGORIES.includes(createCategory as (typeof ALLOWED_CATEGORIES)[number])) {
      setError("Categoria inválida");
      return;
    }
    setCreateSaving(true);
    setError(null);
    try {
      const body: {
        name: string;
        description: string;
        category: string;
        enabled: boolean;
        guildId?: string | null;
      } = {
        name,
        description: createDescription.trim(),
        category: createCategory,
        enabled: createEnabled,
      };
      if (createScope === "guild" && createGuildId.trim()) body.guildId = createGuildId.trim();
      else body.guildId = null;
      const res = await fetch(`${base}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar comando");
      setCreateModalOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateCategory("custom");
      setCreateScope("global");
      setCreateGuildId("");
      setCreateEnabled(true);
      await fetchCommands();
      await fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar comando");
    } finally {
      setCreateSaving(false);
    }
  };

  const openCreateModal = () => {
    setError(null);
    setCreateName("");
    setCreateDescription("");
    setCreateCategory("custom");
    setCreateScope("global");
    setCreateGuildId("");
    setCreateEnabled(true);
    setCreateModalOpen(true);
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
            onClick={openCreateModal}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Criar comando
          </button>
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
                        onClick={() => confirmDelete(cmd.name)}
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

      {deletedCommands.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-red-400/90 mb-2">
            Comandos excluídos (soft delete)
          </h3>
          <div className="rounded-lg border border-red-900/50 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-red-900/30 text-red-200/90">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Uses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-900/30">
                {deletedCommands.map((cmd) => (
                  <tr key={`${cmd.name}-${cmd.guildId ?? "global"}`} className="text-red-300/90 bg-red-950/20">
                    <td className="px-4 py-3 font-mono text-red-200">{cmd.name}</td>
                    <td className="px-4 py-3 text-red-300/80">{cmd.guildId ? `Guild ${cmd.guildId}` : "Global"}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{cmd.description}</td>
                    <td className="px-4 py-3">{cmd.category}</td>
                    <td className="px-4 py-3 text-red-400">Excluído</td>
                    <td className="px-4 py-3">{cmd.stats?.totalUses ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onlyOnDiscord.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-amber-400/90 mb-2">
            Comandos que existem no Discord mas não aqui (fonte da verdade: Mongo)
          </h3>
          <div className="rounded-lg border border-amber-900/50 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-900/30 text-amber-200/90">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {onlyOnDiscord.map((c) => (
                  <tr key={c.id} className="text-zinc-300">
                    <td className="px-4 py-3 font-mono text-white">{c.name}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{c.description}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveOrphanFromDiscord(c.name)}
                        disabled={actionLoading === `orphan-${c.name}`}
                        className="rounded bg-amber-900/50 px-2 py-1 text-xs text-amber-200 hover:bg-amber-800/50 disabled:opacity-50"
                      >
                        {actionLoading === `orphan-${c.name}` ? "Removendo…" : "Remover do Discord"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  <h2 className="text-lg font-semibold text-white">Editar comando</h2>
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
                  <PencilEditInput
                    value={editName}
                    onConfirm={confirmNameEdit}
                    label="Nome"
                    placeholder="nome-do-comando"
                    maxLength={32}
                    inputClassName="font-mono"
                  />
                  <div>
                    <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Categoria</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {ALLOWED_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <PencilEditInput
                    value={editDescription}
                    onConfirm={confirmDescriptionEdit}
                    label="Descrição"
                    placeholder="Descrição do comando"
                    maxLength={100}
                  />
                  <div className="grid grid-cols-2 gap-3">
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
                  <div className="pt-3 border-t border-zinc-700 flex justify-end">
                    <button
                      type="button"
                      onClick={saveDetailCommand}
                      disabled={detailSaving || !hasDetailChange}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {detailSaving ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeDeleteModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div
            className="rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-white mb-2">
              Deletar comando
            </h2>
            <p className="text-zinc-400 text-sm mb-4">
              O comando <span className="font-mono text-zinc-200">{deleteConfirm.name}</span> será removido do banco de dados (não aparece mais na lista). Você pode opcionalmente removê-lo também do Discord.
            </p>
            <label className="flex items-center gap-2 mb-5 cursor-pointer text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={deleteAlsoDiscord}
                onChange={(e) => setDeleteAlsoDiscord(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
              />
              Também remover do Discord (o slash command deixa de aparecer para os usuários)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={!!actionLoading}
                className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeDelete(deleteAlsoDiscord)}
                disabled={!!actionLoading}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {actionLoading ? "Deletando…" : "Deletar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !createSaving && setCreateModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-dialog-title"
        >
          <div
            className="rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-dialog-title" className="text-lg font-semibold text-white mb-4">
              Criar comando
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Nome *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={32}
                  placeholder="nome-do-comando"
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 font-mono text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-zinc-500">{createName.length}/32 (será salvo em minúsculas)</p>
              </div>
              <div>
                <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Descrição *</label>
                <input
                  type="text"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  maxLength={100}
                  placeholder="O que o comando faz"
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-zinc-500">{createDescription.length}/100</p>
              </div>
              <div>
                <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Categoria</label>
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {ALLOWED_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Escopo</label>
                <select
                  value={createScope}
                  onChange={(e) => setCreateScope(e.target.value as "global" | "guild")}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="global">Global</option>
                  <option value="guild">Guild (servidor)</option>
                </select>
                {createScope === "guild" && (
                  <input
                    type="text"
                    placeholder="Guild ID"
                    value={createGuildId}
                    onChange={(e) => setCreateGuildId(e.target.value)}
                    className="mt-2 w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={createEnabled}
                  onChange={(e) => setCreateEnabled(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                />
                Comando ativo (enabled)
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-zinc-700">
              <button
                type="button"
                onClick={() => !createSaving && setCreateModalOpen(false)}
                disabled={createSaving}
                className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCommand}
                disabled={createSaving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {createSaving ? "Criando…" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
