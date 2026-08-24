<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Home, AlertCircle } from "lucide-svelte";

    const is404 = $page.status === 404;
    const is500 = $page.status >= 500;
</script>

<div
    class="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white flex items-center justify-center p-4"
>
    <div class="max-w-md text-center">
        <!-- Icon -->
        <div class="mb-6">
            <div
                class="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center"
            >
                <AlertCircle size={48} class="text-zinc-400" />
            </div>
        </div>

        <!-- Error Code -->
        <h1 class="text-6xl font-bold mb-4">
            {$page.status}
        </h1>

        <!-- Message -->
        <h2 class="text-2xl font-semibold mb-2">
            {#if is404}
                Pagina Non Trovata
            {:else if is500}
                Errore del Server
            {:else}
                Si è Verificato un Errore
            {/if}
        </h2>

        <p class="text-zinc-500 dark:text-zinc-400 mb-8">
            {#if is404}
                La pagina che stai cercando non esiste o è stata spostata.
            {:else if is500}
                Si è verificato un problema con il server. Riprova tra poco.
            {:else}
                {$page.error?.message ||
                    "Si è verificato un errore imprevisto."}
            {/if}
        </p>

        <!-- Action -->
        <a href="/dashboard">
            <Button class="bg-blue-600 hover:bg-blue-700">
                <Home size={16} class="mr-2" />
                Torna alla Dashboard
            </Button>
        </a>
    </div>
</div>
