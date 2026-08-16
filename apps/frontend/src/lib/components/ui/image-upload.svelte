<script lang="ts">
  import { Upload, X, ImageIcon } from "lucide-svelte";
  import { addToast } from "$lib/stores/toast.svelte";
  import { onDestroy } from "svelte";

  let {
    currentImageUrl = null,
    onupload,
    ondelete,
    disabled = false,
  }: {
    currentImageUrl?: string | null;
    onupload: (file: File) => Promise<void>;
    ondelete: () => Promise<void>;
    disabled?: boolean;
  } = $props();

  let isDragging = $state(false);
  let isUploading = $state(false);
  let previewUrl = $state<string | null>(null);
  let error = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  const displayUrl = $derived(previewUrl || currentImageUrl);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) processFile(file);
  }

  async function processFile(file: File) {
    error = null;

    // Validate type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      error = "Invalid file type. Allowed: JPEG, PNG, WebP";
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      error = "File too large. Maximum size: 5MB";
      return;
    }

    // Revoke old preview URL if exists
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    // Create preview
    previewUrl = URL.createObjectURL(file);

    // Upload
    isUploading = true;
    try {
      await onupload(file);
      addToast('success', 'Image uploaded')
    } catch (e) {
      error = e instanceof Error ? e.message : "Upload failed";
      addToast('error', e instanceof Error ? e.message : "Upload failed");
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
    } finally {
      isUploading = false;
    }
  }

  async function handleDelete() {
    if (!currentImageUrl) return;
    isUploading = true;
    try {
      await ondelete();
      addToast('success', 'Image deleted')
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Delete failed";
      addToast('error', e instanceof Error ? e.message : "Delete failed");
    } finally {
      isUploading = false;
    }
  }

  onDestroy(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  });
</script>

<div class="space-y-2">
  <label for="candidate-photo-input" class="block text-sm font-medium text-slate-300">Candidate Photo</label>

  {#if displayUrl}
    <div class="relative inline-block">
      <img
        src={displayUrl}
        alt="Candidate"
        class="h-32 w-32 rounded-lg object-cover"
      />
      {#if !disabled}
        <button
          type="button"
          onclick={handleDelete}
          disabled={isUploading}
          aria-label="Remove candidate photo"
          class="absolute -right-2 -top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-red-500 p-1 text-white hover:bg-red-600 disabled:opacity-50"
        >
          <X size={14} />
        </button>
      {/if}
    </div>
  {:else}
    <div
      class="flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors {isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500'}"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={() => fileInput?.click()}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInput?.click();
        }
      }}
      role="button"
      tabindex="0"
      aria-label="Upload candidate photo"
    >
      {#if isUploading}
        <div class="animate-spin">
          <Upload size={24} class="text-slate-400" />
        </div>
      {:else}
        <ImageIcon size={24} class="text-slate-400" />
      {/if}
    </div>
    <input
      bind:this={fileInput}
      id="candidate-photo-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      onchange={handleFileSelect}
      class="hidden"
      {disabled}
    />
  {/if}

  {#if error}
    <p class="text-sm text-red-400">{error}</p>
  {/if}

  <p class="text-xs text-slate-500">
    JPEG, PNG, or WebP. Max 5MB.
  </p>
</div>
