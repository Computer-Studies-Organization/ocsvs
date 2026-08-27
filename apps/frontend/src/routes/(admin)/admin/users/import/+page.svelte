<script lang="ts">
  import { isStudentId } from "@cso-voting/student-csv-parser";
  import { parseRosterPdf, parseStudentCsv } from "$lib/utils/pdf-parser";
  import { addToast } from "$lib/stores/toast.svelte";
  import { importUsersInBatches } from "$lib/api/users";
  import { 
    ArrowLeft, 
    Upload, 
    FileSpreadsheet, 
    Copy, 
    CheckCircle, 
    Trash2, 
    Plus, 
    AlertTriangle, 
    Loader, 
    Info, 
    Check, 
    ArrowRight,
    Search
  } from "lucide-svelte";
  import { fade } from "svelte/transition";

  interface PreviewRecord {
    id: string;
    studentId: string;
    lastName: string;
    firstName: string;
    course: string;
    yearLevel: string;
    hasParseError?: boolean;
    parseErrorMessage?: string;
  }

  const COURSES = ["BSCS", "BSIT", "WADT"];
  const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
  // States
  let step = $state(1); // 1: Upload, 2: Preview, 3: Credentials
  let records = $state<PreviewRecord[]>([]);
  let isParsing = $state(false);
  let isImporting = $state(false);
  let isDragging = $state(false);
  let previewSearch = $state("");
  let activeTab = $state("imported"); // "imported" | "skipped"

  // Import results
  let importedList = $state<{ studentId: string; fullName: string; username: string; password: string }[]>([]);
  let skippedList = $state<{ studentId: string; reason: string }[]>([]);
  let importFailure = $state<string | null>(null);

  // Validation
  function getRecordError(rec: PreviewRecord): string | null {
    if (rec.hasParseError) {
      return rec.parseErrorMessage || "Parsing error";
    }
    if (!rec.studentId.trim()) {
      return "Student ID is required";
    }
    if (!isStudentId(rec.studentId.trim())) {
      return "Invalid ID format (expected e.g. C25-01-10306-MAN121 or A25-01-1240-MAN121)";
    }
    if (!rec.firstName.trim()) {
      return "First Name is required";
    }
    if (!rec.lastName.trim()) {
      return "Last Name is required";
    }
    if (!COURSES.includes(rec.course)) {
      return "Invalid course";
    }
    if (!YEAR_LEVELS.includes(rec.yearLevel)) {
      return "Invalid year level";
    }
    return null;
  }

  const invalidCount = $derived(records.filter(r => getRecordError(r) !== null).length);

  // Handlers
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await parseFile(file);
    }
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    await parseFile(file);
  }

  async function parseFile(file: File) {
    const fileName = file.name.toLowerCase();
    const isCsv = file.type === "text/csv" || fileName.endsWith(".csv");
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    if (!isCsv && !isPdf) {
      addToast("error", "Only PDF or CSV files are supported.");
      return;
    }

    isParsing = true;
    try {
      const parsed = isCsv ? parseStudentCsv(await file.text()) : await parseRosterPdf(file);
      const fileType = isCsv ? "CSV" : "PDF";
      if (parsed.length === 0) {
        addToast("error", `No voter records detected in the ${fileType}. Please check file format.`);
      } else {
        records = parsed.map(r => ({
          id: crypto.randomUUID(),
          studentId: r.studentId,
          lastName: r.lastName,
          firstName: r.firstName,
          course: r.course,
          yearLevel: r.yearLevel,
          hasParseError: r.hasParseError,
          parseErrorMessage: r.parseErrorMessage,
        }));
        addToast("success", `Parsed ${parsed.length} records successfully.`);
        step = 2;
      }
    } catch (err: any) {
      addToast("error", "Error parsing roster: " + err.message);
    } finally {
      isParsing = false;
    }
  }

  function recordMatchesSearch(rec: PreviewRecord, query: string): boolean {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      rec.studentId.toLowerCase().includes(q) ||
      rec.firstName.toLowerCase().includes(q) ||
      rec.lastName.toLowerCase().includes(q) ||
      rec.course.toLowerCase().includes(q) ||
      rec.yearLevel.toLowerCase().includes(q)
    );
  }

  function addStudent() {
    records.push({
      id: crypto.randomUUID(),
      studentId: "",
      firstName: "",
      lastName: "",
      course: "BSCS",
      yearLevel: "1st Year",
    });
    addToast("info", "New row added at the bottom");
  }

  function deleteRecord(index: number) {
    records = records.filter((_, idx) => idx !== index);
    addToast("info", "Voter record removed");
  }

  async function submitImport() {
    if (invalidCount > 0) {
      addToast("error", "Please resolve all validation errors before importing.");
      return;
    }

    isImporting = true;
    importedList = [];
    skippedList = [];
    importFailure = null;
    try {
      const payload = records.map(r => ({
        studentId: r.studentId.trim(),
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        course: r.course,
        yearLevel: r.yearLevel,
      }));

      await importUsersInBatches(payload, (res) => {
        importedList = [...importedList, ...(res.imported || [])];
        skippedList = [...skippedList, ...(res.skipped || [])];
      });

      if (importedList.length > 0) {
        downloadCredentialsCsv(false);
        addToast("success", `Successfully imported ${importedList.length} voters.`);
      }
      if (skippedList.length > 0) {
        addToast("info", `${skippedList.length} records were skipped due to conflicts.`);
      }

      step = 3;
      activeTab = importedList.length > 0 ? "imported" : "skipped";
    } catch (err: any) {
      const message = "Error submitting import: " + err.message;
      if (importedList.length > 0 || skippedList.length > 0) {
        importFailure = message;
        activeTab = importedList.length > 0 ? "imported" : "skipped";
        step = 3;
        if (importedList.length > 0) downloadCredentialsCsv(false);
        addToast("error", `${message} Successful batch results are available below.`);
      } else {
        addToast("error", message);
      }
    } finally {
      isImporting = false;
    }
  }

  function downloadCredentialsCsv(showToast = true) {
    const headers = ["Student ID", "Full Name", "Username", "Password"];
    const rows = importedList.map(item => [
      item.studentId,
      item.fullName,
      item.username,
      item.password
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `voter_credentials_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (showToast) {
      addToast("success", "Credentials CSV downloaded successfully");
    } else {
      addToast("info", "If the file didn't download, use Download CSV below.");
    }
  }

  async function copyAllCredentials() {
    const text = importedList.map(item => 
      `Student ID: ${item.studentId}\nName: ${item.fullName}\nUsername: ${item.username}\nPassword: ${item.password}\n----------------------------------------`
    ).join("\n");

    try {
      await navigator.clipboard.writeText(text);
      addToast("success", "All credentials copied to clipboard");
    } catch (err: any) {
      addToast("error", "Failed to copy: " + err.message);
    }
  }
</script>

<div class="w-full bg-slate-950 text-slate-100 flex-1 flex flex-col min-h-screen">
  <div class="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500"></div>

  <div class="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8 w-full flex-1 flex flex-col">
    <!-- Header -->
    <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <a href="/admin/users" class="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-100 transition uppercase tracking-wider mb-2">
          <ArrowLeft size={14} /> Back to Users
        </a>
        <h1 class="text-2xl font-black text-slate-50 sm:text-3xl">Voter Bulk Import</h1>
        <p class="mt-1 text-xs text-slate-500">Import student lists from PDF or CSV rosters and generate credentials</p>
      </div>
    </header>

    <!-- Step Progress Bar -->
    <div class="mb-8 max-w-xl mx-auto w-full">
      <div class="flex items-center justify-between relative">
        <!-- Connecting Line -->
        <div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-800 -z-10 rounded-full">
          <div class="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500" style="width: {((step - 1) / 2) * 100}%"></div>
        </div>
        
        <!-- Step 1 Indicator -->
        <div class="flex flex-col items-center">
          <button 
            onclick={() => step = 1}
            disabled={step === 3 || isImporting}
            class="min-h-11 min-w-11 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed
              {step >= 1 ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-slate-700 text-slate-400'}"
          >
            {#if step > 1}
              <Check size={18} strokeWidth={3} />
            {:else}
              1
            {/if}
          </button>
          <span class="mt-2 text-[10px] font-bold uppercase tracking-wider {step >= 1 ? 'text-amber-300' : 'text-slate-500'}">Upload</span>
        </div>

        <!-- Step 2 Indicator -->
        <div class="flex flex-col items-center">
          <button 
            onclick={() => step = 2}
            disabled={(step !== 2 && records.length === 0) || step === 3 || isImporting}
            class="min-h-11 min-w-11 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed
              {step >= 2 ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-slate-700 text-slate-400'}"
          >
            {#if step > 2}
              <Check size={18} strokeWidth={3} />
            {:else}
              2
            {/if}
          </button>
          <span class="mt-2 text-[10px] font-bold uppercase tracking-wider {step >= 2 ? 'text-amber-300' : 'text-slate-500'}">Preview</span>
        </div>

        <!-- Step 3 Indicator -->
        <div class="flex flex-col items-center">
          <div 
            class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300
              {step >= 3 ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-slate-700 text-slate-400'}"
          >
            3
          </div>
          <span class="mt-2 text-[10px] font-bold uppercase tracking-wider {step >= 3 ? 'text-amber-300' : 'text-slate-500'}">Export</span>
        </div>
      </div>
    </div>

    <!-- Main Container -->
    <div class="flex-1 flex flex-col">
      {#if step === 1}
        <!-- Step 1: File Upload Dropzone -->
        <div class="max-w-3xl mx-auto w-full" in:fade={{ duration: 150 }}>
          <div 
            class="relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 sm:min-h-[320px] sm:p-12
              {isDragging ? 'border-amber-500 bg-amber-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'}"
            role="button"
            tabindex="0"
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            onclick={() => !isParsing && document.getElementById('file-upload')?.click()}
            onkeydown={(e) => { if (!isParsing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); document.getElementById('file-upload')?.click(); } }}
          >
            {#if isParsing}
              <div class="flex flex-col items-center justify-center space-y-4" in:fade>
                <div class="relative flex items-center justify-center">
                  <div class="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
                  <Upload size={24} class="absolute text-amber-400 animate-pulse" />
                </div>
                <div class="text-amber-300 font-bold text-lg">Processing Roster File</div>
                <p class="text-slate-400 text-sm max-w-xs leading-relaxed">
                  Extracting text and parsing student records... This might take a few seconds.
                </p>
              </div>
            {:else}
              <div class="flex flex-col items-center" in:fade>
                <div class="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-6 border border-amber-500/20">
                  <Upload size={32} />
                </div>
                <h3 class="text-lg font-bold text-slate-50">Upload Student List PDF or CSV</h3>
                <p class="text-slate-400 text-sm max-w-sm mt-2 mb-8 leading-relaxed">
                  Drag and drop your registrar PDF or CSV roster here, or click to browse your files.
                </p>
                
                <input 
                  type="file" 
                  accept=".pdf,.csv"
                  onchange={handleFileSelected} 
                  class="hidden" 
                  id="file-upload" 
                />
                <button
                  type="button"
                  class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-slate-950 font-extrabold px-6 py-3 shadow-[0_4px_12px_rgba(245,158,11,0.2)] transition-all duration-300 cursor-pointer"
                >
                  Choose PDF or CSV File
                </button>
              </div>
            {/if}
          </div>

          <!-- Roster Guidelines -->
          <div class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6">
            <h4 class="text-sm font-bold text-slate-350 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Info size={16} class="text-amber-400" /> Roster PDF/CSV Guidelines
            </h4>
            <ul class="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>Expected format contains student numbers (e.g. <code>C23-01-095</code>).</li>
              <li>Expected courses: <code>BSCS</code>, <code>BSIT</code>, or <code>WADT</code>.</li>
              <li>Expected year levels: <code>1ST</code>, <code>2ND</code>, <code>3RD</code>, or <code>4TH</code>.</li>
            </ul>
          </div>
        </div>

      {:else}
        <!-- Step 2 and 3 Views -->
        <div class="flex-1 flex flex-col">
          {#if step === 2}
            <!-- Step 2: Preview & Edit -->
            <div class="w-full flex-1 flex flex-col space-y-6" in:fade={{ duration: 150 }}>
              <!-- Stats & Filters Toolbar -->
              <div class="flex flex-wrap gap-4 items-center justify-between bg-slate-900/40 border border-slate-800 p-4 rounded-2xl sm:p-6">
                <div class="flex items-center gap-6">
                  <div>
                    <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Parsed</div>
                    <div class="text-2xl font-black text-slate-100">{records.length}</div>
                  </div>
                  <div class="h-8 w-px bg-slate-800"></div>
                  <div>
                    <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">With Errors</div>
                    <div class="text-2xl font-black {invalidCount > 0 ? 'text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'text-emerald-400'}">
                      {invalidCount}
                    </div>
                  </div>
                </div>

                <!-- Actions / Search bar -->
                <div class="flex flex-wrap gap-3 items-center">
                  <div class="relative w-full sm:w-64">
                    <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter records..."
                      bind:value={previewSearch}
                      class="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-100 placeholder-slate-500 transition focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onclick={addStudent}
                    class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
                  >
                    <Plus size={14} /> Add Student
                  </button>
                </div>
              </div>

              <!-- Editable Table -->
              <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div class="overflow-x-auto">
                  <table class="w-full text-sm text-left">
                    <thead>
                      <tr class="border-b border-slate-800 bg-slate-950/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <th class="px-4 py-3 w-16 text-center">#</th>
                        <th class="px-4 py-3 w-48">Student ID</th>
                        <th class="px-4 py-3">Last Name</th>
                        <th class="px-4 py-3">First Name</th>
                        <th class="px-4 py-3 w-36">Course</th>
                        <th class="px-4 py-3 w-40">Year Level</th>
                        <th class="px-4 py-3 w-28 text-center">Status</th>
                        <th class="px-4 py-3 w-16 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each records as record, index (record.id)}
                        {#if recordMatchesSearch(record, previewSearch)}
                          {@const err = getRecordError(record)}
                          <tr class="border-b border-slate-800/60 transition hover:bg-slate-800/20 {err ? 'bg-rose-950/5' : ''}">
                            <td class="px-4 py-3 text-center text-slate-500 font-semibold">{index + 1}</td>
                            <td class="px-4 py-3">
                              <input
                                type="text"
                                bind:value={record.studentId}
                                oninput={() => { record.hasParseError = false; record.parseErrorMessage = undefined; }}
                                placeholder="e.g. C25-01-10306-MAN121"
                                class="w-full bg-slate-950 border rounded-lg px-3 py-1.5 text-sm font-semibold transition
                                  {err && (!record.studentId.trim() || !isStudentId(record.studentId.trim()))
                                    ? 'border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50' 
                                    : 'border-slate-800 focus:border-amber-500 focus:outline-none'}"
                              />
                            </td>
                            <td class="px-4 py-3">
                              <input
                                type="text"
                                bind:value={record.lastName}
                                oninput={() => { record.hasParseError = false; record.parseErrorMessage = undefined; }}
                                placeholder="Last Name"
                                class="w-full bg-slate-950 border rounded-lg px-3 py-1.5 text-sm font-semibold transition
                                  {err && !record.lastName.trim() 
                                    ? 'border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50' 
                                    : 'border-slate-800 focus:border-amber-500 focus:outline-none'}"
                              />
                            </td>
                            <td class="px-4 py-3">
                              <input
                                type="text"
                                bind:value={record.firstName}
                                oninput={() => { record.hasParseError = false; record.parseErrorMessage = undefined; }}
                                placeholder="First Name"
                                class="w-full bg-slate-950 border rounded-lg px-3 py-1.5 text-sm font-semibold transition
                                  {err && !record.firstName.trim() 
                                    ? 'border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50' 
                                    : 'border-slate-800 focus:border-amber-500 focus:outline-none'}"
                              />
                            </td>
                            <td class="px-4 py-3">
                              <select
                                bind:value={record.course}
                                onchange={() => { record.hasParseError = false; record.parseErrorMessage = undefined; }}
                                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus:border-amber-500 focus:outline-none"
                              >
                                {#each COURSES as course (course)}
                                  <option value={course}>{course}</option>
                                {/each}
                              </select>
                            </td>
                            <td class="px-4 py-3">
                              <select
                                bind:value={record.yearLevel}
                                onchange={() => {
                                  record.hasParseError = false;
                                  record.parseErrorMessage = undefined;
                                }}
                                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus:border-amber-500 focus:outline-none"
                              >
                                {#each YEAR_LEVELS as level (level)}
                                  <option value={level}>{level}</option>
                                {/each}
                              </select>
                            </td>
                            <td class="px-4 py-3 text-center">
                              {#if err}
                                <span 
                                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase cursor-help select-none"
                                  title={err}
                                >
                                  <AlertTriangle size={11} /> Error
                                </span>
                              {:else}
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase select-none">
                                  <Check size={11} /> Valid
                                </span>
                              {/if}
                            </td>
                            <td class="px-4 py-3 text-center">
                              <button
                                onclick={() => deleteRecord(index)}
                                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-400 hover:text-rose-450 hover:border-rose-500/30 transition cursor-pointer"
                                title="Delete row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        {/if}
                      {/each}

                      {#if records.length === 0}
                        <tr>
                          <td colspan="8" class="h-32 text-center text-slate-500">
                            No voter records. Click "+ Add Student" to start adding rows manually.
                          </td>
                        </tr>
                      {/if}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Footer Toolbar -->
              <div class="flex flex-col items-stretch gap-3 bg-slate-900/20 border border-slate-800/80 p-4 rounded-2xl sm:flex-row sm:items-center sm:justify-between">
                <button
                  onclick={() => {
                    records = [];
                    step = 1;
                  }}
                  disabled={isImporting}
                  class="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer"
                >
                  Reset
                </button>

                <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                  {#if invalidCount > 0}
                    <span class="text-xs text-rose-400 font-semibold flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle size={14} /> Resolve {invalidCount} error(s) to import
                    </span>
                  {/if}

                  <button
                    onclick={submitImport}
                    disabled={isImporting || records.length === 0 || invalidCount > 0}
                    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-slate-950 font-extrabold px-6 py-2.5 shadow-[0_4px_12px_rgba(245,158,11,0.2)] transition-all duration-300 disabled:opacity-30 disabled:pointer-events-none transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    {#if isImporting}
                      <Loader size={16} class="animate-spin" /> Importing...
                    {:else}
                      Import {records.length} Voters <ArrowRight size={16} />
                    {/if}
                  </button>
                </div>
              </div>
            </div>

          {:else if step === 3}
            <!-- Step 3: Export Credentials -->
            <div class="w-full flex-1 flex flex-col space-y-6" in:fade={{ duration: 150 }}>
              
              <!-- Success Banner -->
              <div class="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle size={20} />
                </div>
                <div class="space-y-1">
                  <h3 class="font-extrabold text-emerald-400 text-lg">{importFailure ? "Import Partially Complete" : "Import Complete"}</h3>
                  <p class="text-sm text-slate-400 leading-relaxed">
                    Successfully registered <span class="font-bold text-slate-100">{importedList.length}</span> new voters. 
                    {#if skippedList.length > 0}
                      <span class="font-semibold text-rose-400 ml-1">{skippedList.length} records were skipped due to existing records.</span>
                    {/if}
                  </p>
                  {#if importFailure}
                    <p class="text-sm text-amber-300 leading-relaxed">{importFailure} Credentials from successful batches are available below.</p>
                  {/if}
                </div>
              </div>

              <!-- Crucial Warning Box -->
              <div class="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl flex items-start gap-4 shadow-[0_0_24px_rgba(245,158,11,0.05)]">
                <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Info size={20} />
                </div>
                <div class="space-y-2 w-full">
                  <h4 class="font-extrabold text-amber-400 text-sm uppercase tracking-wider">Crucial Warning: Export Credentials Now</h4>
                  <p class="text-sm text-slate-300 leading-relaxed">
                    Passwords are encrypted/hashed on the server and cannot be recovered later. 
                    Please download the CSV or copy the credentials now.
                  </p>
                  <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
                    <button
                      onclick={() => downloadCredentialsCsv()}
                      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-slate-950 font-extrabold px-5 py-2 text-xs transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer shadow-[0_4px_12px_rgba(245,158,11,0.15)]"
                    >
                      <FileSpreadsheet size={14} /> Download CSV
                    </button>
                    <button
                      onclick={copyAllCredentials}
                      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-850 hover:text-slate-100 transition cursor-pointer"
                    >
                      <Copy size={14} /> Copy All
                    </button>
                  </div>
                </div>
              </div>

              <!-- Credentials and Skipped Tables with Tabs -->
              <div class="border border-slate-800 rounded-2xl bg-slate-900 overflow-hidden">
                {#if skippedList.length > 0}
                  <div class="flex border-b border-slate-800 bg-slate-950/40">
                    <button
                      onclick={() => activeTab = "imported"}
                      class="min-h-11 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer
                        {activeTab === 'imported' ? 'border-amber-500 text-amber-400 bg-slate-900/40' : 'border-transparent text-slate-500 hover:text-slate-300'}"
                    >
                      Imported ({importedList.length})
                    </button>
                    <button 
                      onclick={() => activeTab = "skipped"} 
                      class="min-h-11 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer
                        {activeTab === 'skipped' ? 'border-amber-500 text-amber-400 bg-slate-900/40' : 'border-transparent text-slate-500 hover:text-slate-300'}"
                    >
                      Skipped ({skippedList.length})
                    </button>
                  </div>
                {/if}

                {#if activeTab === "imported"}
                  <div class="overflow-x-auto" in:fade={{ duration: 100 }}>
                    <table class="w-full text-sm text-left">
                      <thead>
                        <tr class="border-b border-slate-800 bg-slate-950/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                          <th class="px-4 py-3 w-16 text-center">#</th>
                          <th class="px-4 py-3">Student ID</th>
                          <th class="px-4 py-3">Full Name</th>
                          <th class="px-4 py-3">Username</th>
                          <th class="px-4 py-3">Temporary Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each importedList as voter, idx (voter.studentId)}
                          <tr class="border-b border-slate-800/60 transition hover:bg-slate-800/10">
                            <td class="px-4 py-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                            <td class="px-4 py-3 font-semibold text-slate-50">{voter.studentId}</td>
                            <td class="px-4 py-3 font-semibold text-slate-50">{voter.fullName}</td>
                            <td class="px-4 py-3 text-slate-300">{voter.username}</td>
                            <td class="px-4 py-3 font-mono text-amber-300 font-bold select-all cursor-pointer" title="Click to select all">{voter.password}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {:else}
                  <div class="overflow-x-auto" in:fade={{ duration: 100 }}>
                    <table class="w-full text-sm text-left">
                      <thead>
                        <tr class="border-b border-slate-800 bg-slate-950/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                          <th class="px-4 py-3 w-16 text-center">#</th>
                          <th class="px-4 py-3 w-48">Student ID</th>
                          <th class="px-4 py-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each skippedList as skip, idx (idx)}
                          <tr class="border-b border-slate-800/60 transition hover:bg-slate-850/30">
                            <td class="px-4 py-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                            <td class="px-4 py-3 font-semibold text-rose-400">{skip.studentId}</td>
                            <td class="px-4 py-3 text-slate-450 font-medium">{skip.reason}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </div>

              <!-- Finished Action Button -->
              <div class="flex justify-end">
                <a
                  href="/admin/users"
                  class="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-bold text-slate-200 transition hover:bg-slate-800 hover:text-slate-50 cursor-pointer"
                >
                  Done & Return
                </a>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
