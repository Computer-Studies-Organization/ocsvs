<script lang="ts">
  let { size = 40 } = $props()
</script>

<div
  class="animate-spin rounded-full border-4 border-current border-t-transparent"
  style="width: {size}px; height: {size}px;"
  role="status"
  aria-label="Loading"
></div>
