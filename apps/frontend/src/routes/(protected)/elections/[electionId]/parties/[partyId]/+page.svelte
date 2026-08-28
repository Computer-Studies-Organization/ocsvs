<script lang='ts'>
  import { ArrowLeft, Flag } from 'lucide-svelte'

  let { data } = $props()
</script>

<svelte:head>
  <title>{data.party.name} | CSO Voting System</title>
</svelte:head>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='mx-auto w-full max-w-3xl space-y-6 px-4 py-5 sm:px-6 sm:py-8'>
    <a
      href='/elections/{data.electionId}'
      class='inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-400 transition hover:text-white'
    >
      <ArrowLeft size={16} />
      Back to election
    </a>

    <main class='space-y-6'>
      <header class='rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>
        <div class='flex items-start gap-4'>
          <span
            class='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl'
            style='background: {data.party.color || '#3B82F6'}20; color: {data.party.color || '#60A5FA'}'
          >
            <Flag size={24} />
          </span>
          <div class='min-w-0'>
            <p class='font-mono text-xs font-bold uppercase tracking-wider text-sky-400'>{data.party.code}</p>
            <h1 class='mt-1 break-words text-2xl font-black text-slate-50 sm:text-3xl'>{data.party.name}</h1>
          </div>
        </div>
      </header>

      <section class='rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>
        <h2 class='text-xs font-bold uppercase tracking-wider text-slate-500'>Platform</h2>
        {#if data.party.description}
          <p class='mt-3 whitespace-pre-wrap leading-relaxed text-slate-300'>{data.party.description}</p>
        {:else}
          <p class='mt-3 text-slate-500'>No platform description provided.</p>
        {/if}
      </section>
    </main>
  </div>
</div>
