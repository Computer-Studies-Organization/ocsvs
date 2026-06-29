<script lang='ts'>
  const now = new Date()
  const year = now.getFullYear()
  // Philippine school year runs Jun–Mar: AY starts in June of the current
  // calendar year. From Jan through May, the active AY started the previous year.
  const ayStartYear = now.getMonth() >= 5 ? year : year - 1
</script>

<!--
  Landing page — centered headline framed by hairline rules. Uses the
  same slate/blue palette and system type as the rest of the app so the
  transition into /auth is seamless.
-->

<div class='flex min-h-[100dvh] flex-col bg-slate-950 text-slate-100'>
  <main class='flex flex-1 items-center justify-center px-6 py-12'>
    <div class='w-full max-w-3xl text-center fade-in'>
      <p class='mb-8 text-xs font-bold uppercase tracking-wider text-slate-500'>
        Student Elections &nbsp;·&nbsp; AY {ayStartYear}–{ayStartYear + 1}
      </p>

      <div class='border-y border-white/15 py-10 sm:py-14'>
        <h1
          class='font-black tracking-tight text-white text-[clamp(2.5rem,8.5vw,5.75rem)] leading-[0.96]'
        >
          Mark your ballot<span class='text-blue-500'>.</span>
        </h1>
      </div>

      <p
        class='mx-auto mt-10 max-w-xl text-base font-medium leading-relaxed text-slate-400 sm:text-lg'
      >
        Verified, audited, and live for ACLC students.
      </p>

      <div class='mt-14 flex justify-center'>
        <a href='/auth' class='cta'>
          <span>Sign in to vote</span>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            stroke-width='2'
            stroke-linecap='round'
            stroke-linejoin='round'
            aria-hidden='true'
          >
            <path d='M5 12h14' />
            <path d='m12 5 7 7-7 7' />
          </svg>
        </a>
      </div>
    </div>
  </main>

  <footer class='px-8 py-8 text-center'>
    <p class='text-xs font-bold uppercase tracking-wider text-slate-600'>
      ACLC College &nbsp;·&nbsp; Computer Studies Organization &nbsp;·&nbsp; {year}
    </p>
  </footer>
</div>

<style>
  /* CTA — ghost button. Hover shifts border + text to blue-500 and
     nudges the arrow. Respects reduced-motion. */
  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 2rem;
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 0.75rem;
    font-weight: 700;
    transition:
      border-color 200ms ease,
      color 200ms ease;
    cursor: pointer;
  }
  .cta:hover {
    border-color: var(--color-blue-500);
    color: var(--color-blue-500);
  }
  .cta:hover :global(svg) {
    transform: translateX(4px);
  }
  .cta :global(svg) {
    transition: transform 200ms ease;
  }
  .cta:active {
    transform: translateY(1px);
  }
  .cta:focus-visible {
    outline: none;
    border-color: var(--color-blue-500);
    box-shadow: 0 0 0 1px var(--color-blue-500);
  }

  /* Page-load fade — only motion in the page. */
  .fade-in {
    animation: fade-in 900ms ease both;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fade-in {
      animation: none;
    }
    .cta:hover :global(svg) {
      transform: none;
    }
    .cta:active {
      transform: none;
    }
  }
</style>
