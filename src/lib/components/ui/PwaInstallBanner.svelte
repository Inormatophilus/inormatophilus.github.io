<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { lsGet, lsSet, LS_KEYS } from '$lib/services/storage';

  let visible = $state(false);
  let deferredPrompt = $state<Event | null>(null);
  let isIos = $state(false);

  $effect(() => {
    if (typeof window === 'undefined') return;

    // Check if already installed
    const perm = lsGet<boolean>(LS_KEYS.INSTALL_DECLINE_PERM, false);
    if (perm) return;

    // Check re-ask delay (2 days)
    const ts = lsGet<number>(LS_KEYS.INSTALL_DECLINE_TS, 0);
    if (ts && Date.now() - ts < 2 * 24 * 60 * 60 * 1000) return;

    // iOS detection
    const ua = navigator.userAgent;
    isIos = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;

    if (isIos) {
      // Show iOS install guide if not already in standalone
      const inStandalone = ('standalone' in window.navigator) &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone;
      if (!inStandalone) visible = true;
      return;
    }

    // Android / Desktop: listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      visible = true;
    });

    window.addEventListener('appinstalled', () => {
      visible = false;
      lsSet(LS_KEYS.INSTALL_DECLINE_PERM, true);
    });
  });

  async function install() {
    if (!deferredPrompt) return;
    (deferredPrompt as Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }).prompt();
    const choice = await (deferredPrompt as Event & { userChoice: Promise<{ outcome: string }> }).userChoice;
    if (choice.outcome === 'accepted') {
      lsSet(LS_KEYS.INSTALL_DECLINE_PERM, true);
    }
    deferredPrompt = null;
    visible = false;
  }

  function dismiss(permanent = false) {
    visible = false;
    if (permanent) {
      lsSet(LS_KEYS.INSTALL_DECLINE_PERM, true);
    } else {
      lsSet(LS_KEYS.INSTALL_DECLINE_TS, Date.now());
    }
  }
</script>

{#if visible}
  <div class="install-banner">
    <div style="font-size:2rem">📱</div>
    <div style="flex:1">
      {#if isIos}
        <div style="font-weight:600;font-size:0.9rem">{app.t('install_ios_title')}</div>
        <div class="text-sm text-dim">{app.t('install_ios_hint')}</div>
      {:else}
        <div style="font-weight:600;font-size:0.9rem">{app.t('install_title')}</div>
        <div class="text-sm text-dim">{app.t('install_hint')}</div>
      {/if}
    </div>
    <div style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end">
      {#if !isIos && deferredPrompt}
        <button class="btn btn-primary btn-sm" onclick={install}>{app.t('install_btn')}</button>
      {/if}
      <button class="btn btn-ghost btn-sm" onclick={() => dismiss(false)}>{app.t('install_later')}</button>
      <button class="btn btn-ghost btn-sm" style="font-size:0.7rem;opacity:0.5" onclick={() => dismiss(true)}>
        {app.t('install_never')}
      </button>
    </div>
  </div>
{/if}
