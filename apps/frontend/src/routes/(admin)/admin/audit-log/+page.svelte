<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Filter,
    History,
    X,
  } from "lucide-svelte";
  import {
    type AuditLogEntry,
    type AuditLogFilters,
    fetchAuditLog,
  } from "$lib/api/audit-log";
  import { getElection } from "$lib/api/elections";
  import { fetchUser } from "$lib/api/users";
  import { getCandidate } from "$lib/api/candidates";
  import SkeletonTable from "$lib/components/ui/skeleton-table.svelte";

  const AUDIT_ACTIONS = [
    "election.create",
    "election.update",
    "election.transition",
    "position.create",
    "position.update",
    "position.delete",
    "candidate.create",
    "candidate.update",
    "candidate.deactivate",
    "user.update",
    "user.soft_delete",
    "user.restore",
  ];

  const TARGET_TYPES = ["election", "position", "candidate", "user"];

  // Filter state (synced with URL search params)
  let actionFilter = $state(page.url.searchParams.get("action") ?? "");
  let targetTypeFilter = $state(
    page.url.searchParams.get("targetType") ?? "",
  );
  let targetIdFilter = $state(page.url.searchParams.get("targetId") ?? "");
  let actorFilter = $state(page.url.searchParams.get("actorId") ?? "");
  let sinceDate = $state(page.url.searchParams.get("since") ?? "");
  let untilDate = $state(page.url.searchParams.get("until") ?? "");

  // Pagination state
  let items = $state<AuditLogEntry[]>([]);
  let nextCursor = $state<string | null>(null);
  let cursorStack = $state<string[]>([]);
  let isLoading = $state(true);
  let errorMsg = $state("");

  // Expanded row state
  let expandedId = $state<string | null>(null);
  let resolvedNames = $state<Record<string, string>>({});
  let resolvingIds = $state<Record<string, boolean>>({});

  function syncParamsToUrl() {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (targetTypeFilter) params.set("targetType", targetTypeFilter);
    if (targetIdFilter) params.set("targetId", targetIdFilter);
    if (actorFilter) params.set("actorId", actorFilter);
    if (sinceDate) params.set("since", sinceDate);
    if (untilDate) params.set("until", untilDate);
    const qs = params.toString();
    goto(`/admin/audit-log${qs ? `?${qs}` : ""}`, {
      replaceState: true,
      keepFocus: true,
    });
  }

  function buildFilters(): AuditLogFilters {
    const f: AuditLogFilters = {};
    if (actionFilter) f.action = actionFilter;
    if (targetTypeFilter) f.targetType = targetTypeFilter;
    if (targetIdFilter) f.targetId = targetIdFilter;
    if (actorFilter) f.actorId = actorFilter;
    if (sinceDate) {
      const d = new Date(sinceDate + "T00:00:00");
      f.since = Math.floor(d.getTime() / 1000);
    }
    if (untilDate) {
      const d = new Date(untilDate + "T23:59:59");
      f.until = Math.floor(d.getTime() / 1000);
    }
    return f;
  }

  async function loadPage(cursor?: string) {
    isLoading = true;
    errorMsg = "";
    try {
      const filters = buildFilters();
      const page = await fetchAuditLog({ ...filters, cursor, limit: 50 });
      items = page.items;
      nextCursor = page.nextCursor;
    } catch (e: any) {
      errorMsg = e.message || "Failed to load audit log";
    } finally {
      isLoading = false;
    }
  }

  function handleNext() {
    if (nextCursor) {
      cursorStack = [...cursorStack, nextCursor];
      loadPage(nextCursor);
    }
  }

  function handlePrev() {
    if (cursorStack.length > 0) {
      const newStack = [...cursorStack];
      newStack.pop();
      cursorStack = newStack;
      const prevCursor = newStack[newStack.length - 1];
      loadPage(prevCursor);
    }
  }

  function clearFilters() {
    actionFilter = "";
    targetTypeFilter = "";
    targetIdFilter = "";
    actorFilter = "";
    sinceDate = "";
    untilDate = "";
    cursorStack = [];
    syncParamsToUrl();
    loadPage();
  }

  function handleFilterChange() {
    cursorStack = [];
    syncParamsToUrl();
    loadPage();
  }

  function toggleExpand(entry: AuditLogEntry) {
    if (expandedId === entry.id) {
      expandedId = null;
    } else {
      expandedId = entry.id;
      resolveTargetName(entry);
    }
  }

  async function resolveTargetName(entry: AuditLogEntry) {
    const key = `${entry.targetType}:${entry.targetId}`;
    if (resolvedNames[key] || resolvingIds[key]) return;
    resolvingIds[key] = true;
    try {
      let name = "";
      if (entry.targetType === "election") {
        const e = await getElection(entry.targetId);
        name = e.name;
      } else if (entry.targetType === "user") {
        const u = await fetchUser(entry.targetId);
        name = `${u.firstName} ${u.lastName}`;
      } else if (entry.targetType === "candidate") {
        const c = await getCandidate(entry.targetId);
        name = c.fullName;
      } else if (entry.targetType === "position") {
        // Positions live under an election, so resolving a name needs the
        // electionId context. Until the audit log returns that (or a
        // /positions/:id endpoint exists), display the raw id.
        name = entry.targetId;
      }
      resolvedNames[key] = name || entry.targetId;
    } catch {
      resolvedNames[key] = entry.targetId;
    } finally {
      resolvingIds[key] = false;
    }
  }


  function truncateId(id: string): string {
    return id.length > 16 ? id.slice(0, 16) + "…" : id;
  }

  function formatTimestamp(unixSeconds: number): string {
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleString();
  }

  function getTargetLink(entry: AuditLogEntry): string | null {
    if (entry.targetType === "election") {
      return `/admin/elections/${entry.targetId}`;
    }
    if (entry.targetType === "user") {
      return "/admin/users";
    }
    // Candidate doesn't have a dedicated detail page
    return null;
  }

  const hasActiveFilters = $derived(
    actionFilter || targetTypeFilter || targetIdFilter || actorFilter || sinceDate || untilDate,
  );

  onMount(() => {
    loadPage();
  });
</script>

<div class="min-h-[100dvh] bg-slate-950 text-slate-100">
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <!-- Header -->
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p
          class="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300/90 mb-2"
        >
          <span
            class="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
          ></span>
          Admin Panel
        </p>
        <h1 class="text-2xl font-black sm:text-3xl text-slate-100">
          Audit Log
        </h1>
        <p class="mt-1 text-xs text-slate-400">
          Monitor all admin actions across the system
        </p>
      </div>
    </header>

    <!-- Filters -->
    <div class="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div class="mb-3 flex items-center gap-2">
        <Filter
          size={14}
          class="text-slate-400"
        />
        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Filters</span>
        {#if hasActiveFilters}
          <button
            onclick={clearFilters}
            class="ml-auto flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition cursor-pointer"
          >
            <X size={12} />
            Clear Filters
          </button>
        {/if}
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <!-- Action filter -->
        <div>
          <label
            for="filter-action"
            class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Action
          </label>
          <select
            id="filter-action"
            bind:value={actionFilter}
            onchange={handleFilterChange}
            class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition focus:border-sky-400 focus:outline-none"
          >
            <option value="">All actions</option>
            {#each AUDIT_ACTIONS as action (action)}
              <option value={action}>{action}</option>
            {/each}
          </select>
        </div>

        <!-- Target type filter -->
        <div>
          <label
            for="filter-target-type"
            class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Target Type
          </label>
          <select
            id="filter-target-type"
            bind:value={targetTypeFilter}
            onchange={handleFilterChange}
            class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition focus:border-sky-400 focus:outline-none"
          >
            <option value="">All types</option>
            {#each TARGET_TYPES as type (type)}
              <option value={type}>{type}</option>
            {/each}
          </select>
        </div>

        <!-- Target ID filter -->
        <div>
          <label
            for="filter-target-id"
            class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Target ID
          </label>
          <input
            id="filter-target-id"
            type="text"
            bind:value={targetIdFilter}
            onchange={handleFilterChange}
            placeholder="Filter by target..."
            class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition focus:border-sky-400 focus:outline-none"
          />
        </div>

        <!-- Actor filter -->
        <div>
          <label
            for="filter-actor"
            class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Actor ID
          </label>
          <input
            id="filter-actor"
            type="text"
            bind:value={actorFilter}
            onchange={handleFilterChange}
            placeholder="Filter by actor..."
            class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition focus:border-sky-400 focus:outline-none"
          />
        </div>

        <!-- Since date -->
        <div>
          <label
            for="filter-since"
            class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Since
          </label>
          <input
            id="filter-since"
            type="date"
            bind:value={sinceDate}
            onchange={handleFilterChange}
            class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition focus:border-sky-400 focus:outline-none"
          />
        </div>

        <!-- Until date -->
        <div>
          <label
            for="filter-until"
            class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Until
          </label>
          <input
            id="filter-until"
            type="date"
            bind:value={untilDate}
            onchange={handleFilterChange}
            class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition focus:border-sky-400 focus:outline-none"
          />
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      {#if isLoading}
        <div class="p-4">
          <SkeletonTable rows={8} cols={5} />
        </div>
      {:else if errorMsg}
        <div class="flex h-40 items-center justify-center text-sm text-red-400">
          {errorMsg}
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-950/50">
                <th class="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Time</th>
                <th class="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Actor</th>
                <th class="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Action</th>
                <th class="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Type</th>
                <th class="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Target</th>
              </tr>
            </thead>
            <tbody>
              {#each items as entry (entry.id)}
                <tr
                  class="cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/30 {expandedId === entry.id ? 'bg-slate-950' : ''}"
                  onclick={() => toggleExpand(entry)}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(entry);
                    }
                  }}
                  tabindex="0"
                  role="button"
                  aria-expanded={expandedId === entry.id}
                >
                  <td class="px-4 py-3 text-slate-300">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td class="px-4 py-3 font-semibold text-slate-100">
                    {entry.actorUsernameSnapshot}
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-block rounded-full bg-blue-500/10 text-blue-400 px-2 py-0.5 text-[10px] font-bold">
                      {entry.action}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-block rounded-full bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {entry.targetType}
                    </span>
                  </td>
                  <td class="px-4 py-3 font-mono text-xs text-slate-300">
                    <div class="flex items-center gap-2">
                      <span>{truncateId(entry.targetId)}</span>
                      <ChevronDown
                        size={14}
                        class="transition-transform text-slate-500 {expandedId === entry.id ? 'rotate-180' : ''}"
                      />
                    </div>
                  </td>
                </tr>

                <!-- Expanded row detail -->
                {#if expandedId === entry.id}
                  <tr>
                    <td colspan={5} class="px-4 py-4 bg-slate-950">
                      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Actor Account ID
                            </span>
                            <p class="mt-0.5 font-mono text-xs text-slate-300">
                              {entry.actorAccountIdSnapshot}
                            </p>
                          </div>
                          <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Target ID
                            </span>
                            <p class="mt-0.5 font-mono text-xs text-slate-300">
                              {entry.targetId}
                            </p>
                          </div>
                        </div>

                        {#if entry.description}
                          <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Description
                            </span>
                            <p class="mt-0.5 text-sm text-slate-300">
                              {entry.description}
                            </p>
                          </div>
                        {/if}

                        {#if resolvingIds[`${entry.targetType}:${entry.targetId}`]}
                          <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Resolved Target
                            </span>
                            <p class="mt-0.5 text-sm font-semibold text-slate-400">
                              Resolving...
                            </p>
                          </div>
                        {:else if resolvedNames[`${entry.targetType}:${entry.targetId}`] && resolvedNames[`${entry.targetType}:${entry.targetId}`] !== entry.targetId}
                          <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Resolved Target
                            </span>
                            <p class="mt-0.5 text-sm font-semibold text-slate-100">
                              {resolvedNames[`${entry.targetType}:${entry.targetId}`]}
                            </p>
                          </div>
                        {/if}

                        {#if getTargetLink(entry)}
                          <a
                            href={getTargetLink(entry)}
                            class="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                          >
                            View {entry.targetType === "election" ? "Election" : "Resource"} →
                            <ExternalLink size={12} />
                          </a>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}
              {:else}
                <tr>
                  <td colspan={5} class="h-24 text-center text-sm text-slate-500">
                    <History
                      size={32}
                      class="mx-auto mb-2 text-slate-600"
                    />
                    No audit entries yet
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between border-t border-slate-800 px-4 py-3">
          <p class="text-xs text-slate-500">
            {items.length} {items.length === 1 ? "entry" : "entries"}
            {#if cursorStack.length > 0}
              · Page {cursorStack.length + 1}
            {/if}
          </p>
          <div class="flex items-center gap-2">
            <button
              disabled={cursorStack.length === 0}
              onclick={handlePrev}
              class="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              disabled={!nextCursor}
              onclick={handleNext}
              class="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
