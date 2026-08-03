<script lang='ts'>
  import { X } from 'lucide-svelte'
  import { tick } from 'svelte'
  import { fly, fade } from 'svelte/transition'

  let {
    open = false,
    onclose = () => {},
    ariaLabelledby,
    presentation = 'modal',
    children,
  }: {
    open: boolean
    onclose: () => void
    ariaLabelledby?: string
    presentation?: 'modal' | 'sheet'
    children: import('svelte').Snippet
  } = $props()

  let closeBtn: HTMLButtonElement | undefined = $state()
  let containerEl: HTMLElement | undefined = $state()
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

  function getTabbableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable]'
      )
    ).filter(el => {
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose()
      return
    }

    if (e.key === 'Tab' && containerEl) {
      const tabbables = getTabbableElements(containerEl)
      if (tabbables.length === 0) {
        e.preventDefault()
        return
      }

      const first = tabbables[0]
      const last = tabbables[tabbables.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || !containerEl.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last || !containerEl.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    transition:fade={{ duration: 150 }}
    class={presentation === 'sheet'
      ? 'fixed inset-0 z-50 flex items-end justify-center md:items-center bg-black/60 backdrop-blur-sm p-0 md:p-4'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'}
    role='dialog'
    aria-modal='true'
    aria-labelledby={ariaLabelledby}
    tabindex="-1"
    onclick={onclose}
    onkeydown={handleKeyDown}
    bind:this={containerEl}
  >
    <!-- stop-propagation guard: inner clicks must not close the modal -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      transition:fly={presentation === 'sheet' ? { y: 250, duration: 250 } : { y: 20, duration: 200 }}
      class={presentation === 'sheet'
        ? 'relative w-full max-w-xl rounded-t-2xl rounded-b-none md:rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8 max-h-[85vh] md:max-h-[90vh] overflow-y-auto'
        : 'relative w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8 max-h-[90vh] overflow-y-auto'}
      onclick={(e) => e.stopPropagation()}
    >
      {#if presentation === 'sheet'}
        <div class='flex md:hidden justify-center pb-4 pt-1'>
          <div class='h-1.5 w-12 rounded-full bg-slate-700/60'></div>
        </div>
      {/if}
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
