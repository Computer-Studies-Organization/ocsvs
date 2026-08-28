<script lang='ts'>
  import type { ComponentType } from 'svelte';

  let {
    icon: Icon,
    title,
    description,
    cta,
    oncta,
    secondaryCta,
    onsecondarycta,
  }: {
    icon: ComponentType;
    title: string;
    description: string;
    cta?: string;
    oncta?: () => void;
    secondaryCta?: string;
    onsecondarycta?: () => void;
  } = $props();
</script>

<div class='flex flex-col items-center gap-3 p-8 text-center'>
  <Icon size={40} class='text-slate-500' />
  <h3 class='text-lg font-bold text-slate-200'>{title}</h3>
  <p class='text-sm text-slate-400 max-w-xs'>{description}</p>
  {#if (cta && oncta) || (secondaryCta && onsecondarycta)}
    <div class='flex flex-wrap items-center justify-center gap-3 mt-2'>
      {#if cta && oncta}
        <button
          type='button'
          onclick={oncta}
          class='min-h-11 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-sky-600 transition cursor-pointer'
        >
          {cta}
        </button>
      {/if}
      {#if secondaryCta && onsecondarycta}
        <button
          type='button'
          onclick={onsecondarycta}
          class='min-h-11 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-bold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer'
        >
          {secondaryCta}
        </button>
      {/if}
    </div>
  {/if}
</div>

