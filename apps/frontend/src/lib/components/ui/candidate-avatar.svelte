<script lang="ts">
  let {
    src = null,
    alt = 'Candidate avatar',
    sizeClass = 'h-16 w-16 sm:h-20 sm:w-20',
    class: className = '',
  }: {
    src?: string | null
    alt?: string
    sizeClass?: string
    class?: string
  } = $props()

  let hasError = $state(false)

  $effect(() => {
    // Reset error whenever the image source changes
    const _ = src
    hasError = false
  })
</script>

<div
  class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800 shadow-md {sizeClass} {className}"
  data-testid="candidate-avatar"
>
  {#if src && !hasError}
    <img
      {src}
      {alt}
      class="h-full w-full object-cover"
      onerror={() => {
        hasError = true
      }}
    />
  {:else}
    <svg
      viewBox="0 0 24 24"
      fill="none"
      class="h-full w-full p-2 text-slate-400"
      aria-hidden="true"
      data-testid="candidate-avatar-silhouette"
    >
      <!-- Head -->
      <circle cx="12" cy="8" r="4.2" fill="currentColor" />
      <!-- Torso / Shoulders silhouette (Facebook-like curved solid bust) -->
      <path
        d="M4 21.5C4 16.8 7.5 13.5 12 13.5C16.5 13.5 20 16.8 20 21.5H4Z"
        fill="currentColor"
      />
    </svg>
  {/if}
</div>
