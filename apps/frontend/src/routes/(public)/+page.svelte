<script lang='ts'>
  import { goto } from '$app/navigation'
  import aclcLogo from '$lib/assets/aclcLogo.webp'
</script>

<div class='relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-900'>
  <div class='absolute top-[-10%] left-[-10%] w-125 h-125 rounded-full bg-blue-600/20 blur-[120px]'></div>
  <div class='absolute bottom-[-10%] right-[-10%] w-125 h-125 rounded-full bg-red-600/20 blur-[120px]'></div>

  <div class='relative z-10 w-full max-w-2xl px-6'>
    <div class='bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-3xl shadow-2xl text-center'>

      <div class='relative inline-block mb-8'>
        <div class='absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full'></div>
        <img
          src={aclcLogo}
          alt='CSO Organization Logo'
          class='relative h-32 w-auto mx-auto drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]'
        />
      </div>

      <h1 class='text-5xl flex flex-col md:text-7xl font-black mb-4 uppercase'>
        <span class='text-blue-500'>ACLC</span>
        <span class='text-red-500 text-2xl md:text-3xl'>COMPUTER STUDIES ORGANIZATION</span>
      </h1>

      <p class='text-slate-400 text-lg mb-10 font-medium tracking-wide'>
        Empowering Student Leadership Through Voting
      </p>

      <button onclick={() => goto('/auth')} class='cursor-pointer relative px-10 py-4 font-bold text-white bg-blue-500 rounded-md transition-all duration-300 hover:bg-blue-600'>
        <span class='relative uppercase tracking-[0.2em] text-xl'>
          Start Voting
        </span>
      </button>

    </div>
  </div>
</div>
