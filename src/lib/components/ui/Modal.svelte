<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    onclose?: () => void;
    children?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  }
  let { open = $bindable(), title, onclose, children, footer }: Props = $props();

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onclose?.();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdrop} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal">
      {#if title}
        <div class="modal-header">
          <span class="modal-title">{title}</span>
          <button class="btn-icon" onclick={() => onclose?.()}>✕</button>
        </div>
      {/if}
      <div class="modal-body">
        {@render children?.()}
      </div>
      {#if footer}
        <div class="modal-footer">
          {@render footer?.()}
        </div>
      {/if}
    </div>
  </div>
{/if}
