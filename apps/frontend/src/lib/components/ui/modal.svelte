<script lang='ts'>
  import { X } from 'lucide-svelte'
  import { tick } from 'svelte'

  let {
    open = false,
    onclose = () => {},
    children,
  }: {
    open: boolean
    onclose: () => void
    children: import('svelte').Snippet
  } = $props()

  let closeBtn: HTMLButtonElement | undefined = $state()
  let previousFocus: HTMLElement | null = null

  $effect(() => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      tick().then(() => closeBtn?.focus())
    } else {
      document.body.style.overflow = ''
      previousFocus?.focus()
      previousFocus = null
    }

    return () => {
      document.body.style.overflow = ''
    }
  })
</script>

{#if open}
  <div
    class='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
    role='dialog'
    aria-modal='true'
    tabindex="-1"
    onclick={onclose}
    onkeydown={(e) => { if (e.key === 'Escape') onclose() }}
  >
    <div
      class='relative w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8 max-h-[90vh] overflow-y-auto'
      role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <button
        type='button'
        onclick={onclose}
        aria-label='Close modal'
        bind:this={closeBtn}
        class='absolute right-4 top-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer'
      >
        <X size={20} />
      </button>
      {@render children()}
    </div>
  </div>
{/if}
