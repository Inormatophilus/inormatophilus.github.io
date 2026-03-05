<script lang="ts">
  import { projectsStore } from '$lib/stores/projects.svelte';
  import { app } from '$lib/stores/app.svelte';

  interface Props {
    onselect?: () => void;
  }
  let { onselect }: Props = $props();

  let search = $state('');
  const filtered = $derived(
    projectsStore.projects.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    )
  );
</script>

<div style="
  position:absolute;
  top:calc(100% + 4px);
  left:0;
  right:0;
  background:var(--s1);
  border:1px solid var(--bd2);
  border-radius:var(--r2);
  box-shadow:var(--shadow-lg);
  z-index:400;
  overflow:hidden;
  min-width:220px;
">
  <div style="padding:0.4rem">
    <input
      class="input"
      type="search"
      placeholder="Projekt suchen…"
      bind:value={search}
      autofocus
    />
  </div>

  <div style="max-height:200px;overflow-y:auto">
    {#each filtered as proj}
      <button
        style="
          width:100%;display:flex;align-items:center;gap:0.5rem;
          padding:0.5rem 0.75rem;background:none;border:none;cursor:pointer;
          color:var(--tx);text-align:left;transition:background 0.1s;
          {projectsStore.activeProjectId === proj.id ? 'background:var(--s2)' : ''}
        "
        onclick={() => { projectsStore.switchProject(proj.id); onselect?.(); }}
        onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--s2)'}
        onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = projectsStore.activeProjectId === proj.id ? 'var(--s2)' : ''}
      >
        <span style="
          width:8px;height:8px;border-radius:50%;flex-shrink:0;
          background:{proj.enabled !== false ? 'var(--ac)' : 'var(--td)'}
        "></span>
        <span class="truncate" style="flex:1;font-size:0.9rem">{proj.name}</span>
        {#if projectsStore.activeProjectId === proj.id}
          <span style="color:var(--ac);font-size:0.75rem">●</span>
        {/if}
      </button>
    {/each}
  </div>

  <div style="padding:0.4rem;border-top:1px solid var(--bd)">
    <button
      class="btn btn-secondary btn-sm w-full"
      onclick={() => {
        onselect?.();
        app.closeSettings();
        projectsStore.startCreateMode();
      }}
    >+ Neues Projekt</button>
  </div>
</div>
