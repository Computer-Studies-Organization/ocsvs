<script lang='ts'>
  import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-svelte'
  import { tick } from 'svelte'

  export type DateTimePreset = {
    label: string
    getTimestamp: () => number
  }

  let {
    value = $bindable(null),
    min = null,
    max = null,
    disabled = false,
    presets = [],
    label = '',
    id = '',
    required = false,
    placeholder = 'Select date and time',
    class: className = '',
    onchange = () => {}
  }: {
    value?: number | null
    min?: number | null
    max?: number | null
    disabled?: boolean
    presets?: DateTimePreset[]
    label?: string
    id?: string
    required?: boolean
    placeholder?: string
    class?: string
    onchange?: (val: number | null) => void
  } = $props()

  const generatedId = $props.id()
  const triggerId = $derived(id || generatedId)
  const dialogId = $derived(`${triggerId}-dialog`)

  let isOpen = $state(false)
  let containerEl: HTMLElement | undefined = $state()
  let triggerEl: HTMLButtonElement | undefined = $state()
  let dialogEl: HTMLElement | undefined = $state()

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  // Initial reference date
  function getInitialDate(): Date {
    if (value !== null && Number.isFinite(value)) {
      return new Date(value * 1000)
    }
    if (min !== null && Number.isFinite(min) && min * 1000 > Date.now()) {
      return new Date(min * 1000)
    }
    return new Date()
  }

  const initial = getInitialDate()
  let viewYear = $state(initial.getFullYear())
  let viewMonth = $state(initial.getMonth()) // 0 - 11
  let viewDay = $state(initial.getDate())

  // Time states
  let selectedHour = $state(
    initial.getHours() % 12 === 0 ? 12 : initial.getHours() % 12
  )
  let selectedMinute = $state(initial.getMinutes())
  let selectedAmPm = $state<'AM' | 'PM'>(initial.getHours() >= 12 ? 'PM' : 'AM')

  // Sync internal state if value changes externally
  $effect(() => {
    if (value !== null && Number.isFinite(value)) {
      const d = new Date(value * 1000)
      viewYear = d.getFullYear()
      viewMonth = d.getMonth()
      viewDay = d.getDate()
      const h = d.getHours()
      selectedHour = h % 12 === 0 ? 12 : h % 12
      selectedMinute = d.getMinutes()
      selectedAmPm = h >= 12 ? 'PM' : 'AM'
    }
  })

  // Outside click and Escape listener
  $effect(() => {
    if (!isOpen) return

    void tick().then(() => dialogEl?.focus())

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerEl && !containerEl.contains(e.target as Node)) {
        isOpen = false
      }
    }

    function handlePickerKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closePicker()
      }
    }

    function handleDocumentKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closePicker()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    containerEl?.addEventListener('keydown', handlePickerKeyDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      containerEl?.removeEventListener('keydown', handlePickerKeyDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  })

  function closePicker() {
    isOpen = false
    void tick().then(() => triggerEl?.focus())
  }

  function togglePicker() {
    if (disabled) return
    if (isOpen) closePicker()
    else isOpen = true
  }

  function prevMonth() {
    if (viewMonth === 0) {
      viewMonth = 11
      viewYear -= 1
    } else {
      viewMonth -= 1
    }
    viewDay = Math.min(viewDay, new Date(viewYear, viewMonth + 1, 0).getDate())
  }

  function nextMonth() {
    if (viewMonth === 11) {
      viewMonth = 0
      viewYear += 1
    } else {
      viewMonth += 1
    }
    viewDay = Math.min(viewDay, new Date(viewYear, viewMonth + 1, 0).getDate())
  }

  function isDateDisabled(year: number, month: number, day: number): boolean {
    const endOfDay = Math.floor(new Date(year, month, day, 23, 59, 59, 999).getTime() / 1000)
    if (min !== null && endOfDay < min) return true

    const startOfDay = Math.floor(new Date(year, month, day, 0, 0, 0, 0).getTime() / 1000)
    if (max !== null && startOfDay > max) return true

    return false
  }

  function isDateSelected(year: number, month: number, day: number): boolean {
    if (value === null) return false
    const d = new Date(value * 1000)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
  }

  function isToday(year: number, month: number, day: number): boolean {
    const today = new Date()
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  function getDateLabel(year: number, month: number, day: number): string {
    return new Date(year, month, day).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  function getDaysGrid(year: number, month: number) {
    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const prevMonthTotalDays = new Date(year, month, 0).getDate()

    const cells = []

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthTotalDays - i,
        isCurrentMonth: false,
        disabled: true,
        year: month === 0 ? year - 1 : year,
        month: month === 0 ? 11 : month - 1
      })
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        isCurrentMonth: true,
        disabled: isDateDisabled(year, month, d),
        selected: isDateSelected(year, month, d),
        today: isToday(year, month, d),
        year,
        month
      })
    }

    // Next month padding to fill standard 7x6 grid or round out weeks
    const remaining = (7 - (cells.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        isCurrentMonth: false,
        disabled: true,
        year: month === 11 ? year + 1 : year,
        month: month === 11 ? 0 : month + 1
      })
    }

    return cells
  }

  const calendarGrid = $derived(getDaysGrid(viewYear, viewMonth))

  function computeTimestamp(year: number, month: number, day: number, hour12: number, minute: number, ampm: 'AM' | 'PM'): number {
    let hour24 = hour12 % 12
    if (ampm === 'PM') hour24 += 12
    const d = new Date(year, month, day, hour24, minute, 0, 0)
    return Math.floor(d.getTime() / 1000)
  }

  function assignTimestamp(timestamp: number) {
    const boundedTimestamp = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, timestamp))
    value = boundedTimestamp
    onchange(boundedTimestamp)
  }

  function applyDateSelection(year: number, month: number, day: number) {
    viewDay = day
    assignTimestamp(computeTimestamp(year, month, day, selectedHour, selectedMinute, selectedAmPm))
  }

  function applyTimeChange() {
    let currentY: number
    let currentM: number
    let currentD: number

    if (value !== null) {
      const d = new Date(value * 1000)
      currentY = d.getFullYear()
      currentM = d.getMonth()
      currentD = d.getDate()
    } else {
      currentY = viewYear
      currentM = viewMonth
      currentD = viewDay
    }

    assignTimestamp(computeTimestamp(currentY, currentM, currentD, selectedHour, selectedMinute, selectedAmPm))
  }

  function applyPreset(preset: DateTimePreset) {
    assignTimestamp(preset.getTimestamp())
  }

  function clearValue(e: MouseEvent) {
    e.stopPropagation()
    value = null
    onchange(null)
  }

  const formattedDisplay = $derived.by(() => {
    if (value === null || !Number.isFinite(value)) return ''
    const d = new Date(value * 1000)
    const datePart = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const timePart = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
    return `${datePart}, ${timePart}`
  })
</script>

<div class='relative w-full {className}' bind:this={containerEl}>
  {#if label}
    <label for={triggerId} class='block text-sm font-semibold mb-1.5 text-slate-200'>
      {label}
      {#if required}
        <span class='text-red-400'>*</span>
      {/if}
    </label>
  {/if}

  <div class='relative flex items-center'>
    <button
      type='button'
      id={triggerId}
      onclick={togglePicker}
      disabled={disabled}
      aria-haspopup='dialog'
      aria-expanded={isOpen}
      aria-controls={dialogId}
      bind:this={triggerEl}
      class='min-h-11 w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
      class:pr-9={value !== null && !disabled && !required}
      style='background: oklch(0.16 0.020 250); border-color: {isOpen ? "oklch(0.55 0.15 250)" : "oklch(0.28 0.025 250)"}; color: {formattedDisplay ? "oklch(0.95 0.008 250)" : "oklch(0.60 0.015 250)"}'
    >
      <div class='flex items-center gap-2.5 truncate'>
        <Calendar size={18} class='shrink-0 text-slate-400' />
        <span class='truncate font-medium'>
          {formattedDisplay || placeholder}
        </span>
      </div>
    </button>

    {#if value !== null && !disabled && !required}
      <button
        type='button'
        onclick={clearValue}
        aria-label='Clear date'
        class='absolute right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer'
      >
        <X size={14} />
      </button>
    {/if}
  </div>

  {#if presets.length > 0}
    <div class='flex flex-wrap gap-1.5 mt-2'>
      {#each presets as preset (preset.label)}
        <button
          type='button'
          disabled={disabled}
          onclick={() => applyPreset(preset)}
          class='min-h-11 min-w-11 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 active:scale-95'
          style='background: oklch(0.18 0.025 250); border-color: oklch(0.30 0.025 250); color: oklch(0.85 0.015 250)'
        >
          {preset.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if isOpen}
    <div
      id={dialogId}
      role='dialog'
      aria-label='Date and time selector'
      tabindex='-1'
      bind:this={dialogEl}
      class='absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur-md'
      style='background: oklch(0.14 0.020 250); border-color: oklch(0.28 0.025 250); box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.7)'
    >
      <!-- Month & Year Navigation Header -->
      <div class='flex items-center justify-between mb-3 px-1'>
        <span aria-live='polite' class='text-sm font-bold' style='color: oklch(0.95 0.008 250)'>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <div class='flex items-center gap-1'>
          <button
            type='button'
            onclick={prevMonth}
            aria-label='Previous month'
            class='inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer'
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type='button'
            onclick={nextMonth}
            aria-label='Next month'
            class='inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer'
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <!-- Calendar Days Grid -->
      <div class='grid grid-cols-[repeat(7,minmax(2.75rem,1fr))] gap-1 mb-4 overflow-x-auto text-center'>
        {#each DAY_HEADERS as header (header)}
          <div class='text-xs font-semibold py-1 text-slate-400'>
            {header}
          </div>
        {/each}

        {#each calendarGrid as cell, idx (idx)}
          <button
            type='button'
            disabled={cell.disabled || !cell.isCurrentMonth}
            onclick={() => cell.isCurrentMonth && !cell.disabled && applyDateSelection(cell.year, cell.month, cell.day)}
            aria-label={getDateLabel(cell.year, cell.month, cell.day)}
            aria-pressed={cell.isCurrentMonth ? Boolean(cell.selected) : undefined}
            aria-current={cell.today ? 'date' : undefined}
            class='min-h-11 min-w-11 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-all hover:bg-slate-800'
            class:cursor-pointer={cell.isCurrentMonth && !cell.disabled}
            class:opacity-20={!cell.isCurrentMonth}
            class:opacity-40={cell.isCurrentMonth && cell.disabled}
            class:cursor-not-allowed={cell.disabled || !cell.isCurrentMonth}
            style={cell.selected
              ? 'background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250); font-weight: 700;'
              : cell.today
                ? 'border: 1px solid oklch(0.55 0.15 250); color: oklch(0.95 0.008 250);'
                : 'color: oklch(0.90 0.010 250);'}
          >
            {cell.day}
          </button>
        {/each}
      </div>

      <!-- Time Selector Section -->
      <div class='border-t pt-3 flex items-center justify-between gap-2' style='border-color: oklch(0.24 0.025 250)'>
        <div class='flex items-center gap-1.5 text-xs font-semibold text-slate-300'>
          <Clock size={15} class='text-slate-400' />
          <span>Time:</span>
        </div>

        <div class='flex items-center gap-1.5'>
          <!-- Hour Select -->
          <select
            bind:value={selectedHour}
            onchange={applyTimeChange}
            aria-label='Hour'
            class='min-h-11 min-w-11 rounded-lg border px-2 py-1 text-xs font-bold text-center appearance-none cursor-pointer'
            style='background: oklch(0.18 0.025 250); border-color: oklch(0.30 0.025 250); color: oklch(0.95 0.008 250)'
          >
            {#each Array.from({ length: 12 }, (_, i) => i + 1) as h (h)}
              <option value={h}>{h.toString().padStart(2, '0')}</option>
            {/each}
          </select>

          <span class='text-slate-400 font-bold text-xs'>:</span>

          <!-- Minute Select -->
          <select
            bind:value={selectedMinute}
            onchange={applyTimeChange}
            aria-label='Minute'
            class='min-h-11 min-w-11 rounded-lg border px-2 py-1 text-xs font-bold text-center appearance-none cursor-pointer'
            style='background: oklch(0.18 0.025 250); border-color: oklch(0.30 0.025 250); color: oklch(0.95 0.008 250)'
          >
            {#each Array.from({ length: 60 }, (_, i) => i) as m (m)}
              <option value={m}>{m.toString().padStart(2, '0')}</option>
            {/each}
          </select>

          <!-- AM/PM Toggle Buttons -->
          <div class='flex rounded-lg border p-0.5' style='background: oklch(0.18 0.025 250); border-color: oklch(0.30 0.025 250)'>
            <button
              type='button'
              onclick={() => { selectedAmPm = 'AM'; applyTimeChange(); }}
              class='min-h-11 min-w-11 px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer'
              style={selectedAmPm === 'AM'
                ? 'background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250);'
                : 'color: oklch(0.70 0.015 250);'}
            >
              AM
            </button>
            <button
              type='button'
              onclick={() => { selectedAmPm = 'PM'; applyTimeChange(); }}
              class='min-h-11 min-w-11 px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer'
              style={selectedAmPm === 'PM'
                ? 'background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250);'
                : 'color: oklch(0.70 0.015 250);'}
            >
              PM
            </button>
          </div>
        </div>
      </div>

      <!-- Popover Footer with Done button -->
      <div class='mt-3.5 pt-2 border-t flex justify-end' style='border-color: oklch(0.24 0.025 250)'>
        <button
          type='button'
          onclick={closePicker}
          class='min-h-11 min-w-11 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer'
          style='background: oklch(0.55 0.15 250); color: oklch(0.98 0.005 250)'
        >
          Done
        </button>
      </div>
    </div>
  {/if}
</div>
