<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
</script>

<div class="toast-container" aria-live="polite">
  {#each app.toasts as toast (toast.id)}
    <div class="toast {toast.type}" role="status">
      {#if toast.type === 'success'}✓{:else if toast.type === 'error'}✗{:else if toast.type === 'warn'}⚠{/if}
      {toast.msg}
    </div>
  {/each}
</div>
