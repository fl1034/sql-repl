<script lang="ts">
  import { X, RotateCcw } from 'lucide-svelte'
  import { COLOR_OPTIONS, paletteColor, setPaletteColor, resetPalette } from '../../stores/palette.svelte'
  let open = $state(false)
  let container: HTMLDivElement | undefined = $state()
  let trigger: HTMLButtonElement | undefined = $state()

  function outside(e: PointerEvent) {
    if (e.target instanceof Node && !container?.contains(e.target)) open = false
  }
  function escape(e: KeyboardEvent) {
    if (open && e.key === 'Escape') { open = false; trigger?.focus() }
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={escape} />
<div bind:this={container} class="relative min-w-0 flex-1">
  <button bind:this={trigger} class="flex h-9 w-full min-w-[76px] items-center justify-center rounded-md border border-edge bg-surface px-2 hover:bg-hover" title="Customize theme and syntax colors" aria-label="Customize colors" aria-expanded={open} aria-controls="workspace-color-palette" onclick={() => (open = !open)}>
    <span class="grid w-full grid-cols-5 justify-items-center gap-x-1 gap-y-1.5" aria-hidden="true">
      {#each COLOR_OPTIONS as option}<span class="h-2.5 w-2.5 rounded-[2px] ring-1 ring-inset ring-black/10" style:background-color={paletteColor(option.key)}></span>{/each}
    </span>
  </button>
  {#if open}
    <section id="workspace-color-palette" aria-label="Theme and syntax colors" class="absolute -right-8 top-11 z-50 max-h-[75vh] w-[276px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border border-edge bg-elevated p-3 shadow-xl">
      <div class="mb-1.5 flex items-center justify-between">
        <h2 class="text-xs font-semibold text-fg">Theme & syntax colors</h2>
        <button class="rounded p-1 text-fg-3 hover:bg-hover" aria-label="Close color palette" onclick={() => (open = false)}><X size={14} /></button>
      </div>
      {#each COLOR_OPTIONS as option}
        <label class="flex min-h-7 items-center justify-between gap-2 border-b border-edge-subtle py-0.5 text-xs text-fg-2">
          <span>{option.label}</span>
          <input class="h-5 w-8 shrink-0 cursor-pointer rounded border border-edge bg-surface p-0.5" type="color" aria-label={option.label} value={paletteColor(option.key)} oninput={(e) => setPaletteColor(option.key, e.currentTarget.value)} />
        </label>
      {/each}
      <button class="mt-2 flex items-center gap-1.5 text-xs text-fg-3 hover:text-fg" onclick={resetPalette}><RotateCcw size={12} />Reset colors</button>
      <p class="mt-1.5 text-[10px] leading-relaxed text-fg-4">Changes apply live and are saved in this browser.</p>
    </section>
  {/if}
</div>
