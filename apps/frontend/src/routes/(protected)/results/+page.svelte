<script lang='ts'>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import Spinner from '$lib/components/ui/spinner.svelte'

  onMount(() => {
    goto('/elections', { replaceState: true })
  })
</script>

<div class='flex min-h-[60vh] items-center justify-center'>
  <Spinner size={40} />
</div>
