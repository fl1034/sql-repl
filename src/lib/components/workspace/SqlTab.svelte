<script lang="ts">
  import { untrack } from 'svelte'
  import type { Extension } from '@codemirror/state'
  import { Play, Square, WandSparkles, Pin, Keyboard, Save, Download, ChartColumn, Map as MapIcon } from 'lucide-svelte'
  import Button from '../common/Button.svelte'
  import Tooltip from '../common/Tooltip.svelte'
  import CodeEditor from '../editor/CodeEditor.svelte'
  import QueryParamsBar from '../editor/QueryParamsBar.svelte'
  import ResultPanel from '../editor/ResultPanel.svelte'
  import ChartView from '../charts/ChartView.svelte'
  import Spinner from '../common/Spinner.svelte'
  import { updateSavedQuery } from '@/services/persistence/repositories/savedQueryRepository'
  import { linkQueryFile } from '@/lib/queryFiles'
  import SaveQueryDialog from '../saved-queries/SaveQueryDialog.svelte'
  import { duck, duckActions } from '../../stores/duck.svelte'
  import * as toast from '../../stores/toast.svelte'
  import { listParameterNames, resolveQueryParams } from '@/lib/sqlParams'
  import { PIN_ROW_LIMIT } from '@/lib/resultDiff'
  import { findGeometryColumns } from '@/lib/geoResult'
  import { collaborativeBinding } from '@/lib/editor/collaboration'
  import { locateError } from '@/lib/editor/sqlError'
  import { buildFilteredQuery, isWrappableQuery } from '@/lib/resultTable/filterSql'
  import { resultToGrid } from '@/lib/resultTable/gridData'
  import { runQuery } from '@/services/engine'
  import type { ColumnFilter, ResultSort } from '../../utils/result-filters'
  import type { QueryResult } from '@/store/types'
  import { getCollaboration } from '@/store/slices/sessionSlice'

  interface Props {
    tabId: string
  }

  let { tabId }: Props = $props()

  const SPLIT_KEY = 'duck-ui-split-percent'
  const MIN_SPLIT = 15
  const MAX_SPLIT = 85
  const isMac = /Mac/.test(navigator.platform)
  const mod = isMac ? '⌘' : 'Ctrl'

  const tab = $derived(duck((s) => s.tabs.find((t) => t.id === tabId)))
  const sqlText = $derived(typeof tab?.content === 'string' ? tab.content : '')
  const executing = $derived(duck((s) => !!s.executingTabs[tabId]))
  const progress = $derived(duck((s) => s.queryProgress[tabId]))
  const paramNames = $derived(listParameterNames(sqlText))
  // Cheap: a scan of the column types, not the rows.
  const geometryColumns = $derived(tab?.result && !tab.result.error ? findGeometryColumns(tab.result) : [])
  // A rerun without a GEOMETRY column drops the Map view; the panel falls back to the table.
  const extraViews = $derived([
    { id: 'charts', label: 'Charts', icon: ChartColumn },
    ...(geometryColumns.length > 0 ? [{ id: 'map', label: 'Map', icon: MapIcon }] : []),
  ])

  let editor: CodeEditor | undefined = $state()
  let containerEl: HTMLDivElement | undefined = $state()
  let resultView = $state('table')
  let resizing = $state(false)
  let saveOpen = $state(false)

  const sessionStatus = $derived(duck((s) => s.session.status))
  // Raw and replaced as a whole: the editor reconfigures when the array
  // identity changes, which would tear the binding down on every render.
  let collabExtensions = $state.raw<Extension[]>([])

  // Collaborative binding: attaches only while a session is live, so a solo
  // Duck-UI pays nothing for it.
  $effect(() => {
    if (sessionStatus !== 'connected') return
    const collaboration = getCollaboration()
    if (!collaboration) return

    // The tab must exist in shared state before it can be bound; a tab created
    // locally mid-session would otherwise never reach the other person.
    const { title, content } = untrack(() => ({
      title: tab?.title ?? '',
      content: editor?.getValue() ?? sqlText,
    }))
    collaboration.document.addTab({ id: tabId, title, type: 'sql' }, content)
    const text = collaboration.document.textFor(tabId)
    if (!text) return

    collabExtensions = [collaborativeBinding({ text, presence: collaboration.presence, tabId })]
    return () => {
      collabExtensions = []
    }
  })

  const profileId = $derived(duck((s) => s.currentProfileId))

  const savedSplit = parseFloat(localStorage.getItem(SPLIT_KEY) ?? '')
  let splitPercent = $state(Number.isNaN(savedSplit) ? 45 : savedSplit)

  // What the last run sent, and where it starts in the editor. An error
  // position is relative to this text, not to the document.
  let lastRun: { sql: string; from: number } | null = null

  async function run(sql: string, from = 0) {
    if (executing) return
    if (!sql) {
      toast.warning('Write a query first')
      return
    }
    lastRun = { sql, from }
    editor?.markError(null)
    try {
      await duckActions().executeQuery(sql, tabId)
    } catch (error) {
      console.error('Query execution failed:', error)
      toast.error('Query execution failed')
    }
  }

  // Underline the spot DuckDB points at. With `$name` parameters the engine
  // saw substituted text, and the position is only used when it still lines
  // up with what is in the editor.
  $effect(() => {
    const error = tab?.result?.error
    if (!error || !lastRun || executing) return
    const location = locateError(error, lastRun.sql)
    if (!location) return
    editor?.markError({
      from: lastRun.from + location.from,
      to: lastRun.from + location.to,
      message: error.split('\n')[0],
    })
  })

  /**
   * Sorts and filters in DuckDB, for a result that was cut at the row limit.
   * Runs on the session directly: this is a view of a result, not a query
   * the user wrote, so it stays out of the history.
   */
  async function requery(filters: ColumnFilter[], sort: ResultSort | null): Promise<QueryResult | null> {
    const session = duckActions().currentSession
    const source = lastRun?.sql ?? sqlText
    if (!session || !tab?.result || !isWrappableQuery(source)) return null
    const resolved = resolveQueryParams(source, tab.queryParams)
    if (resolved.sql === null) return null
    const wrapped = buildFilteredQuery(resolved.sql, resultToGrid(tab.result).meta, filters, sort)
    return runQuery(session, wrapped, 'result filter', { maxRows: duckActions().maxResultRows })
  }

  function downloadSql() {
    const sql = editor?.getValue() ?? sqlText
    const name = (tab?.title || 'query').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'query'
    const url = URL.createObjectURL(new Blob([sql], { type: 'application/sql;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = /\.sql$/i.test(name) ? name : `${name}.sql`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function saveFile() {
    if (!tab?.savedQueryId) {
      saveOpen = true
      return
    }
    try {
      await updateSavedQuery(tab.savedQueryId, { sql_text: editor?.getValue() ?? sqlText, name: tab.title })
      duckActions().bumpSavedQueriesVersion()
      toast.success('Query saved')
    } catch {
      toast.error('Failed to save query')
    }
  }

  function runFromToolbar() {
    const target = editor?.getRunTarget()
    void run(target?.text ?? sqlText.trim(), target?.from ?? 0)
  }

  async function cancel() {
    try {
      await duckActions().cancelQuery(tabId)
      toast.info('Query cancelled')
    } catch (error) {
      console.error('Failed to cancel query:', error)
    }
  }

  function pinResult() {
    if (!tab?.result || tab.result.error) return
    const pin = duckActions().pinResult(tabId, sqlText, tab.result)
    const { rows, sourceRowCount, truncated } = pin.snapshot
    if (truncated) {
      toast.warning(
        `Pinned ${rows.length.toLocaleString()} of ${sourceRowCount.toLocaleString()} rows. ` +
          (rows.length >= PIN_ROW_LIMIT
            ? `Pins keep at most ${PIN_ROW_LIMIT.toLocaleString()}`
            : 'The result itself was truncated'),
      )
    } else {
      toast.success(`Pinned ${rows.length.toLocaleString()} rows for comparison`)
    }
  }

  function onResizeStart(e: MouseEvent) {
    e.preventDefault()
    resizing = true
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd)
  }

  function onResizeMove(e: MouseEvent) {
    if (!containerEl) return
    const rect = containerEl.getBoundingClientRect()
    splitPercent = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, ((e.clientY - rect.top) / rect.height) * 100))
  }

  function onResizeEnd() {
    resizing = false
    localStorage.setItem(SPLIT_KEY, splitPercent.toFixed(1))
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
  }
</script>

{#if tab && tab.type === 'sql'}
  <div bind:this={containerEl} class="flex h-full flex-col">
    <div class="flex min-h-0 flex-col" style="height: {splitPercent}%">
      <div class="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-edge-subtle px-2 [scrollbar-width:none]">
        {#if executing}
          <Button size="sm" variant="danger" onclick={cancel}>
            <Square size={12} />
            Stop
          </Button>
        {:else}
          <Button size="sm" onclick={runFromToolbar} title="Run the selection or the statement at the cursor ({mod}+Enter)">
            <Play size={12} />
            Run
          </Button>
        {/if}

        <span class="mx-1 h-4 w-px bg-edge"></span>

        <Button size="sm" variant="ghost" onclick={() => editor?.format()} title="Format SQL (Alt+F)" disabled={!sqlText.trim()}>
          <WandSparkles size={13} />
          Format
        </Button>
        <Button size="sm" variant="ghost" onclick={saveFile} title="Save query" disabled={!sqlText.trim() || !profileId}>
          <Save size={13} />
          Save
        </Button>
        <Button size="sm" variant="ghost" onclick={downloadSql} title="Download SQL file" disabled={!sqlText.trim()}>
          <Download size={13} />
          Download
        </Button>

        <div class="ml-auto flex items-center">
          <Tooltip text="Run selection or statement at cursor: {mod}+Enter. Run everything: {mod}+Shift+Enter. Format: Alt+F. Search: {mod}+F." side="bottom">
            <span class="inline-flex h-7 w-7 items-center justify-center text-fg-4"><Keyboard size={14} /></span>
          </Tooltip>
        </div>
      </div>

      <div class="min-h-0 flex-1">
        <CodeEditor
          bind:this={editor}
          value={sqlText}
          language="sql"
          runScope="statement"
          ariaLabel="SQL editor for {tab.title}"
          placeholder="SELECT * FROM ..."
          onchange={(text) => duckActions().updateTabQuery(tabId, text)}
          onrun={run}
          onrunselection={run}
          extensions={collabExtensions}
          syncValue={collabExtensions.length === 0}
        />
      </div>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="group/split flex h-1 shrink-0 cursor-row-resize items-center justify-center transition-colors hover:bg-active {resizing ? 'bg-accent/60' : 'bg-edge-subtle'}"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize editor and results"
      onmousedown={onResizeStart}
      ondblclick={() => (splitPercent = 45)}
    >
      <div class="h-0.5 w-8 rounded-full transition-colors {resizing ? 'bg-accent' : 'bg-edge-strong group-hover/split:bg-accent/60'}"></div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col">
      <QueryParamsBar {tabId} names={paramNames} />
      <div class="min-h-0 flex-1">
        <ResultPanel
          result={tab.result}
          {executing}
          {progress}
          view={resultView}
          onviewchange={(v) => (resultView = v)}
          oncancel={cancel}
          {requery}
          {extraViews}
        >
          {#snippet extra(view, result)}
            {#if view === 'map'}
              <!-- Loaded on first use so maplibre stays out of the main bundle. -->
              {#await import('../map/GeoMapView.svelte')}
                <div class="flex h-full items-center justify-center"><Spinner /></div>
              {:then { default: GeoMapView }}
                <GeoMapView {result} {geometryColumns} />
              {:catch}
                <p class="p-4 text-xs text-danger" role="alert">The map could not be loaded.</p>
              {/await}
            {:else}
              <ChartView
                {result}
                chartConfig={tab.chartConfig}
                onconfigchange={(config) => duckActions().updateTabChartConfig(tabId, config)}
              />
            {/if}
          {/snippet}
          {#snippet actions()}
            <Button size="xs" variant="ghost" onclick={pinResult} title="Keep a copy of this result to compare against later">
              <Pin size={13} />
              Pin result
            </Button>
          {/snippet}
        </ResultPanel>
      </div>
    </div>
  </div>

  <SaveQueryDialog open={saveOpen} sql={sqlText} defaultTitle={tab.title} onsaved={(query) => linkQueryFile(tabId, query)} onclose={() => (saveOpen = false)} />

  {#if resizing}
    <div class="fixed inset-0 z-50 cursor-row-resize"></div>
  {/if}
{/if}
