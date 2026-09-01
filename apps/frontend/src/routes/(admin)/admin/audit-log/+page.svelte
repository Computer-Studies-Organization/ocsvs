<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    History,
    SlidersHorizontal,
    X,
  } from "lucide-svelte";
  import {
    AUDIT_ACTIONS,
    AUDIT_TARGET_TYPES,
    type AuditLogEntry,
    type AuditLogFilters,
    fetchAuditLog,
    getAuditTargetFallbackName,
  } from "$lib/api/audit-log";
  import { fetchUser } from "$lib/api/users";
  import { formatTimestamp } from "$lib/utils";
  import { appCache } from "$lib/cache";
  import { getCandidate } from "$lib/api/candidates";
  import SkeletonTable from "$lib/components/ui/skeleton-table.svelte";

  const AUDIT_ACTION_LABELS: Record<string, string> = {
    "election.create": "Election created",
    "election.update": "Election updated",
    "election.transition": "Election status changed",
    "position.create": "Position created",
    "position.update": "Position updated",
    "position.delete": "Position deleted",
    "candidate.create": "Candidate created",
    "candidate.update": "Candidate updated",
    "candidate.deactivate": "Candidate deactivated",
    "party.create": "Party created",
    "party.update": "Party updated",
    "party.delete": "Party deleted",
    "user.create": "User created",
    "user.update": "User updated",
    "user.bulk_import": "Users imported",
    "user.soft_delete": "User archived",
    "user.restore": "User restored",
    "user.hard_delete": "User permanently deleted",
    "user.unlock": "User unlocked",
    "user.reset_password": "User password reset",
  };

  function formatAuditAction(action: string): string {
    const knownLabel = AUDIT_ACTION_LABELS[action];
    if (knownLabel) return knownLabel;

    const fallback = action
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return fallback || action;
  }

  // Filter state (synced with URL search params)
  let actionFilter = $state(page.url.searchParams.get("action") ?? "");
  let targetTypeFilter = $state(
    page.url.searchParams.get("targetType") ?? "",
  );
  let targetIdFilter = $state(page.url.searchParams.get("targetId") ?? "");
  let actorFilter = $state(page.url.searchParams.get("actorId") ?? "");
  let sinceDate = $state(page.url.searchParams.get("since") ?? "");
  let untilDate = $state(page.url.searchParams.get("until") ?? "");
  const initialLimit = page.url.searchParams.get("limit");
  let limitFilter = $state(
    initialLimit && [10, 20, 50].includes(Number(initialLimit))
      ? Number(initialLimit)
      : 10,
  );

  let isFilterExpanded = $state(
    import.meta.env.MODE === "test" ||
    !!(
      page.url.searchParams.get("action") ||
      page.url.searchParams.get("targetType") ||
      page.url.searchParams.get("targetId") ||
      page.url.searchParams.get("actorId") ||
      page.url.searchParams.get("since") ||
      page.url.searchParams.get("until")
    )
  );

  const activeFiltersCount = $derived(
    [
      actionFilter,
      targetTypeFilter,
      targetIdFilter,
      actorFilter,
      sinceDate,
      untilDate,
    ].filter(Boolean).length,
  );

  // Pagination state
  let fetchedItems = $state<AuditLogEntry[]>([]);
  let pageIndex = $state(0);
  let nextCursor = $state<string | null>(null);
  let isLoading = $state(true);
  let errorMsg = $state("");
  let currentQueryId = 0;

  const BATCH_SIZE = 100;

  const displayedItems = $derived(
    fetchedItems.slice(pageIndex * limitFilter, (pageIndex + 1) * limitFilter)
  );

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
    if (limitFilter !== 10) params.set("limit", String(limitFilter));
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

  async function fetchNextBatch() {
    isLoading = true;
    errorMsg = "";
    const queryId = ++currentQueryId;
    try {
      const filters = buildFilters();
      const pageRes = await fetchAuditLog({
        ...filters,
        cursor: nextCursor ?? undefined,
        limit: BATCH_SIZE,
      });
      if (queryId !== currentQueryId) return;
      fetchedItems = [...fetchedItems, ...pageRes.items];
      nextCursor = pageRes.nextCursor;
    } catch (e: any) {
      if (queryId !== currentQueryId) return;
      errorMsg = e.message || "Failed to load audit log";
    } finally {
      if (queryId === currentQueryId) {
        isLoading = false;
      }
    }
  }

  async function resetAndLoad() {
    fetchedItems = [];
    nextCursor = null;
    pageIndex = 0;
    await fetchNextBatch();
  }

  async function handleNext() {
    if (isLoading) return;
    const nextOffset = (pageIndex + 1) * limitFilter;
    if (nextOffset < fetchedItems.length) {
      pageIndex += 1;
    } else if (nextCursor) {
      await fetchNextBatch();
      if (nextOffset < fetchedItems.length) {
        pageIndex += 1;
      }
    }
  }

  function handlePrev() {
    if (pageIndex > 0) {
      pageIndex -= 1;
    }
  }

  function handlePageSizeChange() {
    pageIndex = 0;
    syncParamsToUrl();
  }

  function clearFilters() {
    actionFilter = "";
    targetTypeFilter = "";
    targetIdFilter = "";
    actorFilter = "";
    sinceDate = "";
    untilDate = "";
    limitFilter = 10;
    syncParamsToUrl();
    resetAndLoad();
  }

  function handleFilterChange() {
    syncParamsToUrl();
    resetAndLoad();
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
        const cacheEntry = appCache.get("election", { id: entry.targetId });
        if (cacheEntry.data) {
          name = cacheEntry.data.name;
        } else {
          const e = await cacheEntry.fetch();
          if (e) name = e.name;
        }
      } else if (entry.targetType === "user") {
        const cacheEntry = appCache.get("users", {});
        const cachedUser = cacheEntry.data?.data?.find((u) => u.id === entry.targetId);
        if (cachedUser) {
          name = `${cachedUser.firstName} ${cachedUser.lastName}`;
        } else {
          const u = await fetchUser(entry.targetId);
          name = `${u.firstName} ${u.lastName}`;
        }
      } else if (entry.targetType === "candidate") {
        const c = await getCandidate(entry.targetId);
        name = c.fullName;
      } else if (entry.targetType === "position") {
        // Positions live under an election, so resolving a name needs the
        // electionId context. Until the audit log returns that (or a
        // /positions/:id endpoint exists), display the raw id.
        name = entry.targetId;
      } else if (entry.targetType === "party") {
        // Party rows may have been deleted, so use the immutable audit
        // description snapshot instead of relying on a live party lookup.
        name = getAuditTargetFallbackName(entry);
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



  onMount(() => {
    resetAndLoad();
  });
</script>

<div class="min-h-[100dvh] bg-slate-950 text-slate-100">
  <div class="w-full mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <!-- Header -->
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black sm:text-3xl text-slate-100">
          Audit Log
        </h1>
        <p class="mt-1 text-xs text-slate-400">
          Monitor all admin actions across the system
        </p>
      </div>
    </header>

    <!-- Filters Trigger Bar -->
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex flex-nowrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
        <!-- Filters toggle button -->
        <button
          type="button"
          onclick={() => isFilterExpanded = !isFilterExpanded}
          class="min-h-11 flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-100 transition cursor-pointer relative transition-all whitespace-nowrap {isFilterExpanded ? 'border-sky-500 bg-sky-950/20 shadow-[0_0_12px_rgba(14,165,233,0.15)] text-sky-200' : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800'}"
        >
          <SlidersHorizontal size={14} class={activeFiltersCount > 0 ? 'text-sky-400' : 'text-slate-400'} />
          <span>Filters</span>
          {#if activeFiltersCount > 0}
            <span class="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-sky-950 border border-sky-500/30 text-[10px] font-black text-sky-400 shrink-0">
              {activeFiltersCount}
            </span>
          {/if}
        </button>
      </div>
    </div>

    <!-- Active Filter Pills (Tags) -->
    {#if actionFilter || targetTypeFilter || targetIdFilter || actorFilter || sinceDate || untilDate}
      <div class="mb-4 flex flex-wrap gap-2 items-center">
        {#if actionFilter}
          <button
            type="button"
            onclick={() => { actionFilter = ""; handleFilterChange(); }}
            class="min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group"
          >
            <span>Action: {actionFilter}</span>
            <X size={12} class="text-slate-500 group-hover:text-slate-300 transition" />
          </button>
        {/if}

        {#if targetTypeFilter}
          <button
            type="button"
            onclick={() => { targetTypeFilter = ""; handleFilterChange(); }}
            class="min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group"
          >
            <span>Type: {targetTypeFilter}</span>
            <X size={12} class="text-slate-500 group-hover:text-slate-300 transition" />
          </button>
        {/if}

        {#if targetIdFilter}
          <button
            type="button"
            onclick={() => { targetIdFilter = ""; handleFilterChange(); }}
            class="min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group"
          >
            <span>Target: {targetIdFilter}</span>
            <X size={12} class="text-slate-500 group-hover:text-slate-300 transition" />
          </button>
        {/if}

        {#if actorFilter}
          <button
            type="button"
            onclick={() => { actorFilter = ""; handleFilterChange(); }}
            class="min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group"
          >
            <span>Actor: {actorFilter}</span>
            <X size={12} class="text-slate-500 group-hover:text-slate-300 transition" />
          </button>
        {/if}

        {#if sinceDate}
          <button
            type="button"
            onclick={() => { sinceDate = ""; handleFilterChange(); }}
            class="min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group"
          >
            <span>Since: {sinceDate}</span>
            <X size={12} class="text-slate-500 group-hover:text-slate-300 transition" />
          </button>
        {/if}

        {#if untilDate}
          <button
            type="button"
            onclick={() => { untilDate = ""; handleFilterChange(); }}
            class="min-h-11 flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/30 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer group"
          >
            <span>Until: {untilDate}</span>
            <X size={12} class="text-slate-500 group-hover:text-slate-300 transition" />
          </button>
        {/if}
      </div>
    {/if}

    {#if isFilterExpanded}
      <div
        transition:slide={{ duration: 200 }}
        class="mb-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md relative overflow-hidden"
      >
        <div class="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/20 via-orange-400/40 to-rose-500/20"></div>

        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-400">Filter Audit Logs</h3>
          {#if activeFiltersCount > 0}
            <button
              onclick={clearFilters}
              class="min-h-11 text-xs font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer flex items-center gap-1"
            >
              Clear Filters
            </button>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <!-- Action filter -->
          <div>
            <label for="filter-action" class="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Action</label>
            <select
              id="filter-action"
              bind:value={actionFilter}
              onchange={handleFilterChange}
              class="min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer"
            >
              <option value="">All actions</option>
              {#each AUDIT_ACTIONS as action (action)}
                <option value={action}>{action}</option>
              {/each}
            </select>
          </div>

          <!-- Target type filter -->
          <div>
            <label for="filter-target-type" class="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Target Type</label>
            <select
              id="filter-target-type"
              bind:value={targetTypeFilter}
              onchange={handleFilterChange}
              class="min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer"
            >
              <option value="">All types</option>
              {#each AUDIT_TARGET_TYPES as type (type)}
                <option value={type}>{type}</option>
              {/each}
            </select>
          </div>

          <!-- Target ID filter -->
          <div>
            <label for="filter-target-id" class="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Target ID</label>
            <input
              id="filter-target-id"
              type="text"
              bind:value={targetIdFilter}
              onchange={handleFilterChange}
              placeholder="Filter by target..."
              class="min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
            />
          </div>

          <!-- Actor filter -->
          <div>
            <label for="filter-actor" class="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Actor ID</label>
            <input
              id="filter-actor"
              type="text"
              bind:value={actorFilter}
              onchange={handleFilterChange}
              placeholder="Filter by actor..."
              class="min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
            />
          </div>

          <!-- Since date -->
          <div>
            <label for="filter-since" class="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Since</label>
            <input
              id="filter-since"
              type="date"
              bind:value={sinceDate}
              onchange={handleFilterChange}
              class="min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer"
            />
          </div>

          <!-- Until date -->
          <div>
            <label for="filter-until" class="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Until</label>
            <input
              id="filter-until"
              type="date"
              bind:value={untilDate}
              onchange={handleFilterChange}
              class="min-h-11 w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    {/if}

    {#if errorMsg && fetchedItems.length > 0}
      <div class="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between gap-3 text-red-400">
        <span class="text-sm font-semibold">{errorMsg}</span>
        <button
          onclick={() => errorMsg = ""}
          class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-red-500/10 text-red-400 transition cursor-pointer"
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      </div>
    {/if}

    <!-- Table -->
    <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      {#if isLoading && fetchedItems.length === 0}
        <div class="p-4">
          <SkeletonTable rows={8} cols={5} />
        </div>
      {:else if errorMsg && fetchedItems.length === 0}
        <div class="flex h-40 items-center justify-center text-sm text-red-400">
          {errorMsg}
        </div>
      {:else}
        <div class="relative">
          {#if isLoading}
            <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-10">
              <div class="rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 shadow-xl flex items-center gap-2">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"></div>
                Loading more...
              </div>
            </div>
          {/if}
          <div class="hidden md:block overflow-x-auto">
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
              {#each displayedItems as entry (entry.id)}
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
                  aria-label="{formatAuditAction(entry.action)} for {entry.targetType} {truncateId(entry.targetId)}"
                >
                  <td class="px-4 py-3 text-slate-300">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td class="px-4 py-3 font-semibold text-slate-100">
                    {entry.actorUsernameSnapshot}
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-block rounded-full bg-blue-500/10 text-blue-400 px-2 py-0.5 text-[10px] font-bold">
                      {formatAuditAction(entry.action)}
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

        <div class="md:hidden space-y-3 p-3">
          {#each displayedItems as entry (entry.id)}
            <article class="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40">
              <button
                type="button"
                onclick={() => toggleExpand(entry)}
                aria-expanded={expandedId === entry.id}
                aria-controls={`audit-details-${entry.id}`}
                aria-label={`${formatAuditAction(entry.action)} for ${entry.targetType} ${truncateId(entry.targetId)}`}
                class="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-800/30"
              >
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                      {formatAuditAction(entry.action)}
                    </span>
                    <span class="text-xs text-slate-500">{formatTimestamp(entry.createdAt)}</span>
                  </span>
                  <span class="mt-2 block truncate font-mono text-xs text-slate-300">
                    {entry.targetType} · {truncateId(entry.targetId)}
                  </span>
                  <span class="mt-1 block truncate text-xs font-semibold text-slate-400">
                    {entry.actorUsernameSnapshot}
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  class="shrink-0 text-slate-500 transition-transform {expandedId === entry.id ? 'rotate-180' : ''}"
                />
              </button>

              {#if expandedId === entry.id}
                <div id={`audit-details-${entry.id}`} class="space-y-3 border-t border-slate-800 bg-slate-900/50 p-4">
                  <div class="grid grid-cols-1 gap-3">
                    <div>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Actor Account ID</span>
                      <p class="mt-0.5 break-all font-mono text-xs text-slate-300">{entry.actorAccountIdSnapshot}</p>
                    </div>
                    <div>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target ID</span>
                      <p class="mt-0.5 break-all font-mono text-xs text-slate-300">{entry.targetId}</p>
                    </div>
                  </div>

                  {#if entry.description}
                    <div>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</span>
                      <p class="mt-0.5 text-sm text-slate-300">{entry.description}</p>
                    </div>
                  {/if}

                  {#if resolvingIds[`${entry.targetType}:${entry.targetId}`]}
                    <div>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resolved Target</span>
                      <p class="mt-0.5 text-sm font-semibold text-slate-400">Resolving...</p>
                    </div>
                  {:else if resolvedNames[`${entry.targetType}:${entry.targetId}`] && resolvedNames[`${entry.targetType}:${entry.targetId}`] !== entry.targetId}
                    <div>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resolved Target</span>
                      <p class="mt-0.5 text-sm font-semibold text-slate-100">{resolvedNames[`${entry.targetType}:${entry.targetId}`]}</p>
                    </div>
                  {/if}

                  {#if getTargetLink(entry)}
                    <a
                      href={getTargetLink(entry)}
                      class="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-sky-400 transition-colors hover:text-sky-300"
                    >
                      View {entry.targetType === "election" ? "Election" : "Resource"} →
                      <ExternalLink size={12} />
                    </a>
                  {/if}
                </div>
              {/if}
            </article>
          {:else}
            <div class="flex h-24 items-center justify-center text-sm text-slate-500">
              <History size={28} class="mr-2 text-slate-600" />
              No audit entries yet
            </div>
          {/each}
        </div>
        </div>

        <!-- Pagination -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-800 px-4 py-3">
          <p class="text-xs text-slate-500">
            Showing {displayedItems.length} {displayedItems.length === 1 ? "entry" : "entries"}
            · Page {pageIndex + 1}
          </p>
          <div class="flex flex-wrap items-center gap-4 justify-between sm:justify-end">
            <div class="flex items-center gap-2">
              <label for="page-size-select" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Show:</label>
              <select
                id="page-size-select"
                bind:value={limitFilter}
                onchange={handlePageSizeChange}
                disabled={isLoading}
                class="min-h-11 rounded-xl border-2 border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-100 transition focus:border-orange-500/80 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer disabled:opacity-30"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <button
                disabled={pageIndex === 0 || isLoading}
                onclick={handlePrev}
                class="min-h-11 flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                disabled={!((pageIndex + 1) * limitFilter < fetchedItems.length || nextCursor) || isLoading}
                onclick={handleNext}
                class="min-h-11 flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 transition disabled:opacity-30 hover:bg-slate-800 cursor-pointer"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
