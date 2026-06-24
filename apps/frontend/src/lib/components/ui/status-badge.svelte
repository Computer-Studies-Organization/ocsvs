<script lang='ts'>
  import type { TElectionStatus } from '$lib/types'

  let { status }: { status: TElectionStatus } = $props()

  const colors: Record<TElectionStatus, string> = {
    draft: 'oklch(0.70 0.05 250)',
    open: 'oklch(0.70 0.15 145)',
    closed: 'oklch(0.70 0.12 35)',
    archived: 'oklch(0.60 0.02 250)',
  }
  const labels: Record<TElectionStatus, string> = {
    draft: 'Draft', open: 'Open', closed: 'Closed', archived: 'Archived',
  }
</script>

<span class='badge' style='background: {colors[status]}; color: oklch(0.98 0.005 250);'>
  {labels[status]}
</span>

<style>
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
