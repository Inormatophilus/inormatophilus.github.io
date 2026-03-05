<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    subtitle?: string;
    onclose?: () => void;
    children?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
    maxHeight?: string;
  }
  let { open = $bindable(), title, subtitle, onclose, children, footer, maxHeight = '85vh' }: Props = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="settings-backdrop open"
    onclick={onclose}
    role="presentation"
  ></div>
{/if}

<div
  class="gpx-panel"
  class:open
  style="max-height:{maxHeight}"
  role="dialog"
  aria-modal="true"
>
  <!-- Handle -->
  <div style="display:flex;justify-content:center;padding:0.5rem">
    <div style="width:2.5rem;height:4px;background:var(--bd2);border-radius:2px"></div>
  </div>

  {#if title}
    <div class="panel-header">
      <div>
        <div class="panel-title">{title}</div>
        {#if subtitle}
          <div class="text-sm text-dim">{subtitle}</div>
        {/if}
      </div>
      {#if onclose}
        <button class="btn-icon" onclick={onclose}>✕</button>
      {/if}
    </div>
  {/if}

  <div class="panel-body" style="flex:1;overflow-y:auto">
    {@render children?.()}
  </div>

  {#if footer}
    <div style="padding:0.75rem 1rem;border-top:1px solid var(--bd)">
      {@render footer?.()}
    </div>
  {/if}
</div>
