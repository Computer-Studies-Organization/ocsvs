<!-- apps/frontend/src/lib/components/ui/skeleton-card.svelte -->
<script lang="ts">
  import Skeleton from "./skeleton.svelte";
</script>

<div class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
  <div class="flex items-start justify-between gap-3 mb-3">
    <Skeleton width="60%" height="1.25rem" />
    <Skeleton width="4rem" height="1.5rem" rounded="rounded-full" />
  </div>
  <Skeleton width="100%" height="0.875rem" />
  <Skeleton width="80%" height="0.875rem" />
  <div class="mt-4 flex items-center justify-between">
    <Skeleton width="30%" height="0.75rem" />
    <Skeleton width="4rem" height="0.75rem" />
  </div>
</div>
