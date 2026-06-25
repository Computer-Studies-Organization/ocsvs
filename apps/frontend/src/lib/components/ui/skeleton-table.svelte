<!-- apps/frontend/src/lib/components/ui/skeleton-table.svelte -->
<script lang="ts">
  import Skeleton from "./skeleton.svelte";

  let { rows = 5, cols = 4 }: { rows?: number; cols?: number } = $props();
</script>

<div class="space-y-3">
  {#each { length: rows } as _}
    <div class="flex items-center gap-4">
      {#each { length: cols } as _}
        <Skeleton width="{100 / cols}%" height="1rem" />
      {/each}
    </div>
  {/each}
</div>
