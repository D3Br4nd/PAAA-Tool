<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { startSyncWorker } from "$lib/client/sync/sync-worker-client";

  onMount(() => {
    // Intentionally disabled: the offline mutation queue is an unfinished
    // scaffold and its /api/sync target does not exist. Read the security
    // contract in src/lib/workers/sync.worker.ts before enabling this.
    // startSyncWorker();
  });
</script>

<slot />
