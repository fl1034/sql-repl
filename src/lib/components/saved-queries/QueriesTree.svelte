<script lang="ts">
  import { ChevronRight, ChevronDown, Folder, FolderOpen, FolderPlus, FileCode2 } from 'lucide-svelte'
  import { duck, duckActions } from '../../stores/duck.svelte'
  import { getSavedQueries, type SavedQuery } from '@/services/persistence/repositories/savedQueryRepository'
  import { getQueryFolders, saveQueryFolders, openQueryFile } from '@/lib/queryFiles'
  import * as toast from '../../stores/toast.svelte'
  import Modal from '../common/Modal.svelte'
  import Button from '../common/Button.svelte'
  import Input from '../common/Input.svelte'
  import FormField from '../common/FormField.svelte'

  const profileId = $derived(duck((s) => s.currentProfileId))
  const version = $derived(duck((s) => s.savedQueriesVersion))
  const activeFile = $derived(duck((s) => s.tabs.find((tab) => tab.id === s.activeTabId)?.savedQueryId))
  let queries = $state<SavedQuery[]>([])
  let folders = $state<string[]>([])
  let expanded = $state<string[]>([''])
  let selectedFolder = $state('')
  let folderDialog = $state(false)
  let folderName = $state('')
  let saving = $state(false)
  let loadError = $state(false)

  // Load a consistent snapshot; ignore results from a previous profile or revision.
  $effect(() => {
    const id = profileId
    void version
    let stale = false
    if (!id) { queries = []; folders = []; return }
    Promise.all([getSavedQueries(id), getQueryFolders(id)]).then(([files, paths]) => {
      if (stale) return
      queries = files
      const all = new Set(paths)
      for (const file of files) {
        if (file.folder !== 'default') all.add(file.folder)
      }
      for (const path of [...all]) {
        const parts = path.split('/')
        for (let i = 1; i < parts.length; i++) all.add(parts.slice(0, i).join('/'))
      }
      folders = [...all].sort()
      loadError = false
    }).catch(() => { if (!stale) loadError = true })
    return () => { stale = true }
  })

  function toggle(path: string) {
    selectedFolder = path
    expanded = expanded.includes(path) ? expanded.filter((item) => item !== path) : [...expanded, path]
  }

  function children(path: string): string[] {
    return folders.filter((folder) => folder.split('/').slice(0, -1).join('/') === path)
  }

  function files(path: string): SavedQuery[] {
    return queries.filter((query) => (query.folder === 'default' ? '' : query.folder) === path)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async function createFolder(e: SubmitEvent) {
    e.preventDefault()
    const name = folderName.trim()
    if (!profileId || !name || saving) return
    if (name.includes('/') || name === '.' || name === '..' || (!selectedFolder && name === 'default')) {
      toast.error('Choose a folder name without slashes or reserved path names')
      return
    }
    const path = selectedFolder ? `${selectedFolder}/${name}` : name
    if (folders.includes(path)) { toast.error('That folder already exists'); return }
    saving = true
    try {
      await saveQueryFolders(profileId, [...folders, path])
      expanded = [...new Set([...expanded, '', selectedFolder, path])]
      duckActions().bumpSavedQueriesVersion()
      folderDialog = false
      folderName = ''
    } catch { toast.error('Failed to create folder') }
    finally { saving = false }
  }
</script>

{#snippet branch(path: string)}
  {#each children(path) as folder (folder)}
    <div role="treeitem" aria-label={folder.split('/').at(-1)} aria-selected={selectedFolder === folder} aria-expanded={expanded.includes(folder)}>
      <button class="flex h-7 w-full items-center gap-1.5 rounded-sm px-1 text-xs text-fg-2 hover:bg-hover {selectedFolder === folder ? 'bg-active' : ''}" onclick={() => toggle(folder)}>
        {#if expanded.includes(folder)}<ChevronDown size={12} /><FolderOpen size={14} class="text-accent" />{:else}<ChevronRight size={12} /><Folder size={14} class="text-fg-3" />{/if}
        <span class="truncate">{folder.split('/').at(-1)}</span>
      </button>
      {#if expanded.includes(folder)}
        <div role="group" class="ml-3 border-l border-edge-subtle pl-2">{@render branch(folder)}</div>
      {/if}
    </div>
  {/each}
  {#each files(path) as query (query.id)}
    <button role="treeitem" aria-selected={activeFile === query.id} aria-label={query.name} title="Double-click to open {query.name}" class="flex h-7 w-full items-center gap-2 rounded-sm pl-5 pr-1 text-left text-xs hover:bg-hover {activeFile === query.id ? 'bg-active text-fg' : 'text-fg-2'}" onclick={() => (selectedFolder = path)} ondblclick={() => openQueryFile(query)} onkeydown={(e) => { if (e.key === 'Enter') openQueryFile(query) }}>
      <FileCode2 size={14} class="shrink-0 text-accent" /><span class="truncate">{query.name}</span>
    </button>
  {/each}
  {#if children(path).length === 0 && files(path).length === 0}
    <p class="py-1 pl-5 text-xs text-fg-4">{path ? 'Empty folder' : 'Save a query to get started'}</p>
  {/if}
{/snippet}

<section class="mx-2 mt-3 border-t border-edge-subtle pt-2" aria-label="Saved queries">
  <div role="tree" aria-label="Queries">
  <div role="treeitem" aria-label="Queries" aria-selected={selectedFolder === ''} aria-expanded={expanded.includes('')}>
  <div class="flex items-center gap-1">
    <button class="flex h-8 min-w-0 flex-1 items-center gap-1.5 px-1 text-left text-xs font-medium text-fg" onclick={() => toggle('')} aria-expanded={expanded.includes('')}>
      {#if expanded.includes('')}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
      <FolderOpen size={15} class="text-accent" />Queries
      <span class="ml-auto text-[10px] font-normal text-fg-4">{queries.length}</span>
    </button>
    <Button icon variant="ghost" size="xs" title={selectedFolder ? `New folder in ${selectedFolder}` : 'New folder'} aria-label="New query folder" onclick={() => { folderName = ''; folderDialog = true }} disabled={!profileId}>
      <FolderPlus size={14} />
    </Button>
  </div>
  {#if expanded.includes('')}
    {#if loadError}<p class="px-2 py-2 text-xs text-danger" role="alert">Could not load queries. Reopen the app to retry.</p>{:else}
      <div role="group" class="ml-3 border-l border-edge-subtle pb-2 pl-2">{@render branch('')}</div>
    {/if}
  {/if}
  </div>
  </div>
</section>

<Modal open={folderDialog} title="New query folder" size="sm" onclose={() => (folderDialog = false)}>
  <form id="query-folder-form" onsubmit={createFolder} class="space-y-3">
    <p class="text-xs text-fg-3">Create in Queries{selectedFolder ? ` / ${selectedFolder}` : ''}</p>
    <FormField label="Folder name" for="query-folder-name"><Input id="query-folder-name" bind:value={folderName} placeholder="e.g. Reports" /></FormField>
  </form>
  {#snippet footer()}
    <Button variant="ghost" size="sm" onclick={() => (folderDialog = false)}>Cancel</Button>
    <Button size="sm" type="submit" form="query-folder-form" disabled={!folderName.trim()} loading={saving}>Create folder</Button>
  {/snippet}
</Modal>
