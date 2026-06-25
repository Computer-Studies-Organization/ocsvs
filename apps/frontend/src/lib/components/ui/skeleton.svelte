<!-- apps/frontend/src/lib/components/ui/skeleton.svelte -->
<script lang="ts">
  let {
    width = "100%",
    height = "1rem",
    rounded = "rounded-lg",
  }: {
    width?: string;
    height?: string;
    rounded?: string;
  } = $props();
</script>

<div
  class="animate-pulse bg-slate-800 {rounded}"
  style="width: {width}; height: {height}"
></div>
