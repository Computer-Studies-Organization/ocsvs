<script lang="ts">
  import { Clock } from 'lucide-svelte';
  
  let { 
    targetUnixSeconds, 
    prefix = '', 
    suffix = '', 
    onZero,
    showIcon = true,
    plainText = false,
    class: className = ''
  } = $props<{
    targetUnixSeconds: number;
    prefix?: string;
    suffix?: string;
    onZero?: () => void;
    showIcon?: boolean;
    plainText?: boolean;
    class?: string;
  }>();

  let now = $state(Date.now());
  let hasTriggeredZero = $state(false);
  
  $effect(() => {
    // Access targetUnixSeconds synchronously to register it as a dependency
    const target = targetUnixSeconds;
    hasTriggeredZero = false;

    const interval = setInterval(() => {
      now = Date.now();
      const msLeft = target * 1000 - now;
      if (msLeft <= 0 && !hasTriggeredZero) {
        hasTriggeredZero = true;
        clearInterval(interval);
        onZero?.();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  });

  const formatted = $derived.by(() => {
    const ms = targetUnixSeconds * 1000 - now;
    if (ms <= 0) return '0s';
    
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  });
</script>

{#if plainText}
  {prefix}{formatted}{suffix}
{:else}
  <div class="flex items-center gap-1.5 {className}">
    {#if showIcon}
      <Clock size={14} class="animate-pulse" />
    {/if}
    <span class="font-medium">{prefix}{formatted}{suffix}</span>
  </div>
{/if}
