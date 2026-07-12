<script lang='ts'>
  import { ArrowLeft, Edit, Plus, Users } from 'lucide-svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'
  import type { TElection, TPosition } from '$lib/types'
  import AddCandidateModal from '$lib/components/admin/add-candidate-modal.svelte'
  import EditPositionModal from '$lib/components/admin/edit-position-modal.svelte'

  type CandidateRow = {
    id: string
    fullName: string
    isActive?: number
  }

  let { data } = $props()
  let election = $derived(data.election)
  let position = $derived(data.position)
  let candidates = $derived<CandidateRow[]>(data.candidates)

  let isCreateOpen = $state(false)
  let isEditOpen = $state(false)

  function openCreate() {
    isCreateOpen = true
  }

  function closeCreate() {
    isCreateOpen = false
  }

  function openEdit() {
    isEditOpen = true
  }

  function closeEdit() {
    isEditOpen = false
  }
</script>

<div class='min-h-[100dvh]' style='background: oklch(0.16 0.020 250)'>
  <div class='mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'>
    {#if election}
      <a
        href={`/admin/elections/${election.id}`}
        class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
        style='color: oklch(0.70 0.015 250)'
      >
        <ArrowLeft size={16} />
        {election.name}
      </a>
    {:else}
      <a
        href='/admin/elections'
        class='inline-flex items-center gap-1.5 text-sm font-semibold mb-4 transition-colors hover:opacity-80'
        style='color: oklch(0.70 0.015 250)'
      >
        <ArrowLeft size={16} />
        Back to elections
      </a>
    {/if}

    {#if !position}
      <div
        class='rounded-2xl border p-8 shadow-2xl'
        style='background: oklch(0.40 0.15 25 / 0.15); border-color: oklch(0.40 0.15 25 / 0.4)'
      >
        <p class='text-sm text-center' style='color: oklch(0.95 0.008 250)'>Position not found.</p>
      </div>
    {:else}
      <header
        class='rounded-2xl border p-5 shadow-lg mb-6'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div class='flex items-center gap-3'>
          <h1 class='text-2xl font-black' style='color: oklch(0.95 0.008 250)'>{position.name}</h1>
          {#if election?.status === 'draft'}
            <button
              type='button'
              onclick={openEdit}
              class='rounded-lg p-1.5 transition-colors cursor-pointer'
              style='background: oklch(0.25 0.025 250); color: oklch(0.70 0.015 250)'
              title='Edit position'
            >
              <Edit size={16} />
            </button>
          {/if}
        </div>
        <p class='text-sm mt-1' style='color: oklch(0.70 0.015 250)'>{election?.name ?? ''}</p>
      </header>

      <section
        class='rounded-2xl border p-5 shadow-lg'
        style='background: oklch(0.20 0.022 250); border-color: oklch(0.25 0.025 250)'
      >
        <div class='flex items-center justify-between mb-4'>
          <h2 class='text-lg font-black flex items-center gap-2' style='color: oklch(0.95 0.008 250)'>
            <Users size={18} />
            Candidates
          </h2>
          <button
            type='button'
            onclick={openCreate}
            class='flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-lg cursor-pointer'
            style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); box-shadow: 0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)'
          >
            <Plus size={16} stroke-width={2.5} />
            Add candidate
          </button>
        </div>

        {#if candidates.length === 0}
          <EmptyState
            icon={Users}
            title='No candidates yet'
            description='Add candidates for this position.'
            cta='Add candidate'
            oncta={openCreate}
          />
        {:else}
          <ul class='space-y-2'>
            {#each candidates as c (c.id)}
              <li>
                <a
                  href={`/admin/elections/${election?.id}/positions/${position.id}/candidates/${c.id}`}
                  class='flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-lg cursor-pointer'
                  style='background: oklch(0.18 0.022 250); border-color: oklch(0.25 0.025 250)'
                >
                  <div>
                    <p class='font-bold' style='color: oklch(0.95 0.008 250)'>{c.fullName}</p>
                    {#if c.isActive === 0}
                      <p class='text-xs' style='color: oklch(0.60 0.015 250)'>Inactive</p>
                    {/if}
                  </div>
                  <span class='inline-flex items-center gap-1 text-xs font-bold' style='color: oklch(0.55 0.15 250)'>
                    <Edit size={14} />
                    Edit
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
</div>

{#if election && position}
  {#if isCreateOpen}
    <AddCandidateModal
      onclose={closeCreate}
      electionId={election.id}
      positionId={position.id}
      onsuccess={closeCreate}
    />
  {/if}

{#if isEditOpen}
    <EditPositionModal
      onclose={closeEdit}
      electionId={election.id}
      position={position}
      onsuccess={closeEdit}
    />
  {/if}
{/if}
