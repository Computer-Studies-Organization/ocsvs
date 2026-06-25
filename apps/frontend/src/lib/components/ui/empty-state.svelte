<script lang='ts'>
  import type { ComponentType } from 'svelte';

  let {
    icon: Icon,
    title,
    description,
    cta,
    oncta,
  }: {
    icon: ComponentType;
    title: string;
    description: string;
    cta?: string;
    oncta?: () => void;
  } = $props();
</script>

<div class='flex flex-col items-center gap-3 p-8 text-center'>
  <Icon size={40} class='text-slate-500' />
  <h3 class='text-lg font-bold text-slate-200'>{title}</h3>
  <p class='text-sm text-slate-400 max-w-xs'>{description}</p>
  {#if cta && oncta}
    <button
      type='button'
      onclick={oncta}
      class='mt-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600 transition cursor-pointer'
    >
      {cta}
    </button>
  {/if}
</div>
