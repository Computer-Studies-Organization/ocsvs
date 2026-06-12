<script lang='ts'>
  let {
    percentage = 0,
    gradient = 'from-blue-500 via-indigo-500 to-emerald-400',
  }: {
    percentage: number
    gradient?: string
  } = $props()

  const clampedWidth = $derived(
    Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0,
  )
</script>

<div class='h-2 w-full overflow-hidden rounded-full bg-slate-800'>
  <div
    class='h-full rounded-full bg-gradient-to-r transition-all duration-300 {gradient}'
    style='width: {clampedWidth}%'
    role='progressbar'
    aria-valuenow={clampedWidth}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label='Vote progress'
  ></div>
</div>
