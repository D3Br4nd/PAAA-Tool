<script lang="ts">
    import {
        Settings,
        Wrench,
        Trash2,
        RefreshCw,
        ShieldCheck,
        ImageOff,
        Eraser,
        X,
    } from "lucide-svelte";
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";

    let { data, form } = $props();

    // Dialog State
    let showResetDialog = $state(false);
    let showEventScoresResetDialog = $state(false);
    let showReseedDialog = $state(false);
    let showClearGeoPhotosDialog = $state(false);
    let showClearBrowserCacheDialog = $state(false);
    let selectedEventId = $state("");
    const selectedEvent = $derived(
        data.events.find((event: (typeof data.events)[number]) =>
            event.id === selectedEventId),
    );

    let resetForm: HTMLFormElement;
    let eventScoresResetForm: HTMLFormElement;
    let reseedForm: HTMLFormElement;
    let clearGeoPhotosForm: HTMLFormElement;
    let clearBrowserCacheForm: HTMLFormElement;
</script>

<div class="p-6 lg:p-8 w-full">
    <div class="flex items-center gap-3 mb-8">
        <Settings size={28} class="text-purple-600" />
        <div>
            <h1 class="text-2xl font-bold">Impostazioni</h1>
            <p class="text-zinc-500 dark:text-zinc-400">
                Configura il sistema PAAA-Tool
            </p>
        </div>
    </div>

    <div class="space-y-8">
        <!-- Maintenance Section -->
        <div
            class="bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden shadow-sm"
        >
            <div class="p-6 border-b bg-muted/30 flex items-center gap-3">
                <Wrench size={20} class="text-orange-500" />
                <h2 class="text-lg font-bold">Manutenzione Sistema</h2>
            </div>

            <div class="p-8 space-y-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Reset Event Scores -->
                    <div
                        class="space-y-4 p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-red-200 dark:border-red-900/50"
                    >
                        <h3
                            class="font-bold text-zinc-900 dark:text-white flex items-center gap-2"
                        >
                            <span class="w-2 h-2 rounded-full bg-red-500"
                            ></span>
                            Reset Punteggi Evento
                        </h3>
                        <p
                            class="text-xs text-zinc-600 dark:text-zinc-200 leading-relaxed"
                        >
                            Cancella punteggi, progressi, completamenti, timer e
                            log del solo evento selezionato.
                        </p>
                        <form
                            action="?/resetEventScores"
                            method="POST"
                            use:enhance
                            bind:this={eventScoresResetForm}
                            class="space-y-3"
                        >
                            <label
                                for="reset-scores-event"
                                class="sr-only"
                            >
                                Evento da resettare
                            </label>
                            <select
                                id="reset-scores-event"
                                name="eventId"
                                bind:value={selectedEventId}
                                required
                                disabled={data.events.length === 0}
                                class="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-50"
                            >
                                <option value="">Seleziona evento</option>
                                {#each data.events as event (event.id)}
                                    <option value={event.id}>
                                        {event.name}{event.isActive
                                            ? " (attivo)"
                                            : ""}
                                    </option>
                                {/each}
                            </select>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={!selectedEvent}
                                class="w-full rounded-xl shadow-lg shadow-red-500/10"
                                onclick={() =>
                                    (showEventScoresResetDialog = true)}
                            >
                                <Trash2 size={16} class="mr-2" />
                                Reset Punteggi
                            </Button>
                        </form>
                    </div>

                    <!-- Reset Data -->
                    <div
                        class="space-y-4 p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"
                    >
                        <h3
                            class="font-bold text-zinc-900 dark:text-white flex items-center gap-2"
                        >
                            <span class="w-2 h-2 rounded-full bg-red-500"
                            ></span>
                            Reset Totale Dati
                        </h3>
                        <p
                            class="text-xs text-zinc-600 dark:text-zinc-200 leading-relaxed"
                        >
                            Rimuove eventi, squadre, giocatori, fazioni,
                            programmi, giochi, GeoPhase, Codex, messaggi,
                            punteggi e le altre tabelle dati evento presenti.
                            <strong
                                >Gli utenti Admin e Staff non verranno
                                eliminati.</strong
                            >
                        </p>
                        <form
                            action="?/resetData"
                            method="POST"
                            use:enhance
                            bind:this={resetForm}
                        >
                            <Button
                                type="button"
                                variant="destructive"
                                class="w-full rounded-xl shadow-lg shadow-red-500/10"
                                onclick={() => (showResetDialog = true)}
                            >
                                <Trash2 size={16} class="mr-2" />
                                Resetta Database
                            </Button>
                        </form>
                    </div>

                    <!-- Seed Dummy Data -->
                    <div
                        class="space-y-4 p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"
                    >
                        <h3
                            class="font-bold text-zinc-900 dark:text-white flex items-center gap-2"
                        >
                            <span class="w-2 h-2 rounded-full bg-green-500"
                            ></span>
                            Carica Dati Demo (CaTE 2026)
                        </h3>
                        <p
                            class="text-xs text-zinc-600 dark:text-zinc-200 leading-relaxed"
                        >
                            Resetta il database e carica una struttura di prova
                            completa di Fazioni, Squadre, Giocatori e quattro
                            cacce GeoPhase del Path del Cavaliere. Le cacce
                            restano disattivate finché non vengono inserite e
                            verificate le coordinate GPS.
                        </p>
                        <form
                            action="?/reseedDummy"
                            method="POST"
                            use:enhance
                            bind:this={reseedForm}
                        >
                            <Button
                                type="button"
                                onclick={() => (showReseedDialog = true)}
                                class="w-full bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white rounded-xl shadow-lg"
                            >
                                <RefreshCw size={16} class="mr-2" />
                                Rigenera Dati Demo
                            </Button>
                        </form>
                    </div>

                    <!-- GeoPhase Photos -->
                    <div
                        class="space-y-4 p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-red-200 dark:border-red-900/50"
                    >
                        <h3
                            class="font-bold text-zinc-900 dark:text-white flex items-center gap-2"
                        >
                            <ImageOff size={17} class="text-red-500" />
                            Foto GeoPhase
                        </h3>
                        <p
                            class="text-xs text-zinc-600 dark:text-zinc-200 leading-relaxed"
                        >
                            Cancella definitivamente tutte le foto GeoPhase e i
                            relativi riferimenti. Punteggi e prove già concluse
                            restano invariati; gli invii ancora in attesa tornano
                            caricabili.
                        </p>
                        <form
                            action="?/clearGeoPhotos"
                            method="POST"
                            use:enhance
                            bind:this={clearGeoPhotosForm}
                        >
                            <Button
                                type="button"
                                variant="destructive"
                                class="w-full rounded-xl shadow-lg shadow-red-500/10"
                                onclick={() => (showClearGeoPhotosDialog = true)}
                            >
                                <Trash2 size={16} class="mr-2" />
                                Cancella Foto GeoPhase
                            </Button>
                        </form>
                    </div>

                    <!-- Browser Cache -->
                    <div
                        class="space-y-4 p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"
                    >
                        <h3
                            class="font-bold text-zinc-900 dark:text-white flex items-center gap-2"
                        >
                            <Eraser size={17} class="text-blue-500" />
                            Cache Browser
                        </h3>
                        <p
                            class="text-xs text-zinc-600 dark:text-zinc-200 leading-relaxed"
                        >
                            Richiede al browser di eliminare la cache HTTP di
                            questo sito sul dispositivo corrente. Sessione e dati
                            applicativi non vengono cancellati.
                        </p>
                        <form
                            action="?/clearBrowserCache"
                            method="POST"
                            use:enhance
                            bind:this={clearBrowserCacheForm}
                        >
                            <Button
                                type="button"
                                variant="outline"
                                class="w-full rounded-xl border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20"
                                onclick={() => (showClearBrowserCacheDialog = true)}
                            >
                                <Eraser size={16} class="mr-2" />
                                Svuota Cache Browser
                            </Button>
                        </form>
                    </div>
                </div>

                {#if form?.success}
                    <div
                        class="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-2xl text-green-600 dark:text-green-400 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
                    >
                        <ShieldCheck size={18} />
                        {form.message}
                    </div>
                {/if}

                {#if form?.error}
                    <div
                        class="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
                    >
                        <X size={18} />
                        {form.error}
                    </div>
                {/if}
            </div>
        </div>

        <!-- System Info -->
        <div
            class="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800"
        >
            <p
                class="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold text-center"
            >
                PAAA-Tool v2.0.0-alpha • SvelteKit + Drizzle + LibSQL
            </p>
        </div>
    </div>
</div>

<!-- Confirmation Dialogs -->
<ConfirmDialog
    bind:show={showEventScoresResetDialog}
    title="Reset Punteggi Evento"
    message={selectedEvent
        ? `Verranno cancellati tutti i punteggi, i progressi, i completamenti, i timer e i log di “${selectedEvent.name}”. L'operazione è irreversibile.`
        : "Seleziona un evento da resettare."}
    confirmLabel="Resetta Punteggi"
    type="danger"
    onConfirm={() => selectedEvent && eventScoresResetForm.requestSubmit()}
/>

<ConfirmDialog
    bind:show={showResetDialog}
    title="Reset Totale"
    message="Sei sicuro di voler resettare TUTTI i dati evento? Questa azione elimina eventi, squadre, giocatori, programmi, giochi, moduli collegati e punteggi. Admin e Staff restano. Non può essere annullata."
    confirmLabel="Resetta Tutto"
    type="danger"
    onConfirm={() => resetForm.requestSubmit()}
/>

<ConfirmDialog
    bind:show={showReseedDialog}
    title="Rigenera Dati Demo"
    message="Questa azione resetterà il database e caricherà i dati demo di CaTE 2026. Procedere?"
    confirmLabel="Carica Demo"
    type="warning"
    onConfirm={() => reseedForm.requestSubmit()}
/>

<ConfirmDialog
    bind:show={showClearGeoPhotosDialog}
    title="Cancella Foto GeoPhase"
    message="Tutte le foto GeoPhase verranno eliminate definitivamente dallo storage. Le prove già concluse e i relativi punteggi resteranno invariati; gli invii ancora in attesa dovranno essere caricati nuovamente."
    confirmLabel="Cancella Foto"
    type="danger"
    onConfirm={() => clearGeoPhotosForm.requestSubmit()}
/>

<ConfirmDialog
    bind:show={showClearBrowserCacheDialog}
    title="Svuota Cache Browser"
    message="Il browser eliminerà la cache HTTP del sito su questo dispositivo. La sessione resterà attiva."
    confirmLabel="Svuota Cache"
    type="info"
    onConfirm={() => clearBrowserCacheForm.requestSubmit()}
/>
