<script lang='ts'>
  import { ArrowLeft, CheckCircle2, Flag, Quote, Sparkles, User, Users } from 'lucide-svelte'
  import { onMount } from 'svelte'
  import { parsePlatformText } from '$lib/platform-parser'
  import type { TCandidate, TPartyList, TPosition } from '$lib/types'

  let {
    data,
  }: {
    data: {
      electionId: string
      party: TPartyList
      candidates?: TCandidate[]
      positions?: TPosition[]
    }
  } = $props()

  const party = $derived(data.party)
  const partyColor = $derived(party.color || '#3B82F6')
  const candidates = $derived(data.candidates ?? [])
  const positions = $derived(data.positions ?? [])

  const parsed = $derived(parsePlatformText(party.description))

  const positionMap = $derived(new Map(positions.map((p) => [p.id, p.name])))

  let activeSectionId = $state<string>('')

  function scrollToSection(id: string) {
    activeSectionId = id
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  onMount(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const sectionIds = [
      ...(parsed.isStructured ? parsed.pillars.map((pillar) => pillar.id) : []),
      ...(candidates.length > 0 ? ['slate-roster'] : []),
    ]
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section instanceof HTMLElement)

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]

        if (visible?.target instanceof HTMLElement) activeSectionId = visible.target.id
      },
      { rootMargin: '-6rem 0px -50% 0px' },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  })
</script>

<svelte:head>
  <title>{party.name} | Platform | CSO Voting System</title>
</svelte:head>

<div class='min-h-[100dvh] bg-slate-950 text-slate-100'>
  <div class='mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8'>
    <!-- Back to Election Link -->
    <a
      href='/elections/{data.electionId}'
      class='mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white'
    >
      <ArrowLeft size={16} />
      Back to election
    </a>

    <!-- Mobile Sticky Navigation Bar (Visible on < lg screens) -->
    {#if (parsed.isStructured && parsed.pillars.length > 0) || candidates.length > 0}
      <nav
        aria-label='Mobile platform sections'
        class='sticky top-0 z-20 -mx-4 mb-6 border-b border-white/10 bg-slate-950/95 px-4 py-2.5 backdrop-blur-md lg:hidden'
      >
        <div class='flex items-center gap-2 overflow-x-auto py-1 no-scrollbar'>
          {#if parsed.isStructured}
            {#each parsed.pillars as pillar, idx (pillar.id)}
              <button
                type='button'
                onclick={() => scrollToSection(pillar.id)}
                class='inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer border {activeSectionId === pillar.id ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'}'
              >
                <span
                  class='flex h-4 w-4 items-center justify-center rounded text-[10px] font-black'
                  style='background: {partyColor}30; color: {partyColor}'
                >
                  {pillar.letter || idx + 1}
                </span>
                <span class='max-w-[120px] truncate'>{pillar.title}</span>
              </button>
            {/each}
          {/if}

          {#if candidates.length > 0}
            <button
              type='button'
              onclick={() => scrollToSection('slate-roster')}
              class='inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer border {activeSectionId === 'slate-roster' ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'}'
            >
              <Users size={13} class='text-sky-400' />
              <span>Slate ({candidates.length})</span>
            </button>
          {/if}
        </div>
      </nav>
    {/if}

    <!-- Main Two-Column Layout Grid -->
    <div class='grid grid-cols-1 items-start gap-8 lg:grid-cols-12'>
      <!-- Left Column: Sticky Sidebar on Desktop -->
      <aside class='space-y-5 lg:col-span-4 lg:sticky lg:top-6'>
        <!-- Party Identity Card -->
        <header class='overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur'>
          <div class='flex items-start gap-4'>
            <span
              class='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner'
              style='background: {partyColor}25; color: {partyColor}; border: 1px solid {partyColor}40'
            >
              <Flag size={24} />
            </span>
            <div class='min-w-0 flex-1'>
              <span
                class='inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider'
                style='background: {partyColor}20; color: {partyColor}'
              >
                {party.code}
              </span>
              <h1 class='mt-1.5 break-words text-2xl font-black text-slate-50 sm:text-3xl'>{party.name}</h1>
            </div>
          </div>

          {#if parsed.acronymMeaning}
            <div class='mt-4 border-t border-white/5 pt-3.5'>
              <p class='text-xs font-medium text-slate-300 leading-relaxed italic'>
                &ldquo;{parsed.acronymMeaning}&rdquo;
              </p>
            </div>
          {/if}

          {#if candidates.length > 0}
            <div class='mt-4 flex items-center gap-2 border-t border-white/5 pt-3 text-xs font-semibold text-slate-400'>
              <Users size={14} class='text-sky-400' />
              <span>{candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'} running in slate</span>
            </div>
          {/if}
        </header>

        <!-- Tagline Quote Banner (if detected) -->
        {#if parsed.tagline}
          <div
            class='relative overflow-hidden rounded-2xl border p-5 shadow-xl'
            style='background: {partyColor}10; border-color: {partyColor}35'
          >
            <div class='flex items-start gap-3'>
              <Quote size={20} class='shrink-0 opacity-80' style='color: {partyColor}' />
              <div>
                <p class='text-xs font-bold uppercase tracking-wider' style='color: {partyColor}'>Party Tagline</p>
                <p class='mt-1 text-sm font-semibold text-slate-200 leading-relaxed'>
                  &ldquo;{parsed.tagline}&rdquo;
                </p>
              </div>
            </div>
          </div>
        {/if}

        <!-- Table of Contents (Desktop Navigator) -->
        {#if (parsed.isStructured && parsed.pillars.length > 0) || candidates.length > 0}
          <nav
            aria-label='Platform table of contents'
            class='hidden rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur lg:block'
          >
            <h2 class='text-xs font-bold uppercase tracking-wider text-slate-500'>Platform Navigator</h2>
            <ul class='mt-3 space-y-1'>
              {#if parsed.isStructured}
                {#each parsed.pillars as pillar, idx (pillar.id)}
                  <li>
                    <button
                      type='button'
                      onclick={() => scrollToSection(pillar.id)}
                      class='flex w-full min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition cursor-pointer {activeSectionId === pillar.id ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}'
                    >
                      <span
                        class='flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-black'
                        style='background: {partyColor}20; color: {partyColor}'
                      >
                        {pillar.letter || idx + 1}
                      </span>
                      <span class='truncate'>{pillar.title}</span>
                    </button>
                  </li>
                {/each}
              {/if}

              {#if candidates.length > 0}
                <li class='border-t border-white/5 pt-1 mt-1'>
                  <button
                    type='button'
                    onclick={() => scrollToSection('slate-roster')}
                    class='flex w-full min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition cursor-pointer {activeSectionId === 'slate-roster' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}'
                  >
                    <Users size={14} class='shrink-0 text-sky-400' />
                    <span class='truncate'>Candidate Slate ({candidates.length})</span>
                  </button>
                </li>
              {/if}
            </ul>
          </nav>
        {/if}
      </aside>

      <!-- Right Column: Content Stream -->
      <main class='space-y-6 lg:col-span-8'>
        {#if parsed.intro}
          <p class='rounded-2xl border border-white/10 bg-slate-900/80 p-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-300 shadow-xl sm:p-7 sm:text-base'>
            {parsed.intro}
          </p>
        {/if}

        <!-- Structured Platform Pillars -->
        {#if parsed.isStructured}
          <div class='space-y-5'>
            {#each parsed.pillars as pillar, idx (pillar.id)}
              <section
                id={pillar.id}
                class='scroll-mt-24 rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur transition hover:border-slate-700/80 sm:p-7'
              >
                <div class='flex items-start gap-3.5 sm:gap-4'>
                  <span
                    class='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-black shadow-md'
                    style='background: {partyColor}20; color: {partyColor}; border: 1px solid {partyColor}40'
                  >
                    {pillar.letter || idx + 1}
                  </span>
                  <div class='min-w-0 flex-1'>
                    <span class='text-[11px] font-bold uppercase tracking-wider' style='color: {partyColor}'>
                      Pillar {idx + 1}
                    </span>
                    <h2 class='mt-0.5 text-xl font-black text-slate-100 sm:text-2xl'>{pillar.title}</h2>
                  </div>
                </div>

                {#if pillar.body}
                  <p class='mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300 sm:text-base'>
                    {pillar.body}
                  </p>
                {/if}

                {#if pillar.bullets.length > 0}
                  <ul class='mt-4 space-y-2.5 border-t border-white/5 pt-4'>
                    {#each pillar.bullets as bullet}
                      <li class='flex items-start gap-3 text-sm text-slate-300 sm:text-base'>
                        <span class='mt-1 shrink-0' style='color: {partyColor}'>
                          <CheckCircle2 size={16} />
                        </span>
                        <span class='flex-1 leading-snug'>{bullet}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </section>
            {/each}
          </div>
        {:else if parsed.rawParagraphs.length > 0}
          <!-- Unstructured Platform Fallback -->
          <section class='rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur space-y-4 sm:p-8'>
            <div class='flex items-center gap-2 text-slate-400'>
              <Sparkles size={18} class='text-sky-400' />
              <h2 class='text-xs font-bold uppercase tracking-wider text-slate-400'>Platform Statement</h2>
            </div>
            {#each parsed.rawParagraphs as paragraph}
              <p class='whitespace-pre-wrap text-sm leading-relaxed text-slate-300 sm:text-base'>
                {paragraph}
              </p>
            {/each}
          </section>
        {:else if !parsed.tagline}
          <!-- Empty State -->
          <section class='rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-xl'>
            <Flag size={36} class='mx-auto mb-3 text-slate-600' />
            <h2 class='text-lg font-bold text-slate-200'>Platform Details Pending</h2>
            <p class='mt-2 text-sm text-slate-500'>No platform description provided.</p>
          </section>
        {/if}

        <!-- Slate Candidates Roster Section -->
        {#if candidates.length > 0}
          <section id='slate-roster' class='scroll-mt-24 space-y-4 pt-4 border-t border-white/10'>
            <div class='flex items-center justify-between'>
              <div class='flex items-center gap-2'>
                <Users size={20} class='text-sky-400' />
                <h2 class='text-lg font-black text-slate-100 sm:text-xl'>Candidate Slate</h2>
              </div>
              <span class='text-xs font-semibold text-slate-400'>
                {candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'}
              </span>
            </div>

            <div class='grid grid-cols-1 gap-3.5 sm:grid-cols-2'>
              {#each candidates as candidate (candidate.id)}
                {@const positionName = positionMap.get(candidate.positionId) ?? 'Candidate'}
                <a
                  href='/elections/{data.electionId}'
                  class='flex items-center gap-3.5 rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-lg transition hover:border-slate-700/80 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
                >
                  {#if candidate.imageUrl}
                    <img
                      src={candidate.imageUrl}
                      alt={candidate.fullName}
                      class='h-12 w-12 shrink-0 rounded-full object-cover shadow'
                      style='border: 2px solid {partyColor}'
                    />
                  {:else}
                    <div
                      class='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 shadow'
                      style='border: 2px solid {partyColor}60'
                    >
                      <User size={22} class='text-slate-400' />
                    </div>
                  {/if}

                  <div class='min-w-0 flex-1'>
                    <span
                      class='inline-block max-w-full truncate rounded bg-slate-800/90 px-2 py-0.5 text-[11px] font-bold text-sky-300'
                    >
                      {positionName}
                    </span>
                    <h3 class='mt-1 truncate text-sm font-bold text-slate-100 sm:text-base'>
                      {candidate.fullName}
                    </h3>
                  </div>
                </a>
              {/each}
            </div>
          </section>
        {/if}
      </main>
    </div>
  </div>
</div>
