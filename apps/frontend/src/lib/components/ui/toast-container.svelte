<!-- apps/frontend/src/lib/components/ui/toast-container.svelte -->
<script lang='ts'>
  import { getToastTransition, toasts, dismissToast } from '$lib/stores/toast.svelte';
  import type { ToastType } from '$lib/stores/toast.svelte';
  import { X, CheckCircle, AlertCircle, Info } from 'lucide-svelte';
  import { fly } from 'svelte/transition';

  const icons: Record<ToastType, typeof CheckCircle> = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: {
      bg: 'oklch(0.20 0.03 150)',
      border: 'oklch(0.40 0.12 150)',
      text: 'oklch(0.90 0.05 150)',
      icon: 'oklch(0.65 0.15 150)',
    },
    error: {
      bg: 'oklch(0.20 0.03 25)',
      border: 'oklch(0.40 0.12 25)',
      text: 'oklch(0.90 0.05 25)',
      icon: 'oklch(0.65 0.15 25)',
    },
    info: {
      bg: 'oklch(0.20 0.03 250)',
      border: 'oklch(0.40 0.12 250)',
      text: 'oklch(0.90 0.05 250)',
      icon: 'oklch(0.65 0.15 250)',
    },
  };

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const toastTransition = getToastTransition(prefersReducedMotion);
</script>

<div class='fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6 sm:w-auto sm:max-w-md z-[100] flex flex-col gap-2'>
  {#each toasts.list as toast (toast.id)}
    {@const Icon = icons[toast.type]}
    {@const c = colors[toast.type]}
    <div
      role='alert'
      transition:fly={toastTransition}
      class='flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm border transition-all'
      style='background: {c.bg}; border-color: {c.border}; color: {c.text}'
    >
      <Icon size={18} style='color: {c.icon}; flex-shrink: 0' />
      <p class='text-sm font-medium'>{toast.message}</p>
      <button
        type='button'
        onclick={() => dismissToast(toast.id)}
        aria-label='Dismiss notification'
        class='ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1 transition-colors hover:bg-white/10 cursor-pointer'
      >
        <X size={14} />
      </button>
    </div>
  {/each}
</div>
