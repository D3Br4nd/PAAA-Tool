<script lang="ts">
    import { Button } from "./ui/button";
    import { AlertTriangle, Info, Trash2 } from "lucide-svelte";
    import { fade, scale } from "svelte/transition";

    let {
        show = $bindable(false),
        title = "Conferma Azione",
        message = "Sei sicuro di voler procedere?",
        confirmLabel = "Conferma",
        cancelLabel = "Annulla",
        type = "warning", // 'warning', 'danger', 'info'
        onConfirm = () => {},
        onCancel = () => {},
    } = $props();

    function handleConfirm() {
        onConfirm();
        show = false;
    }

    function handleCancel() {
        onCancel();
        show = false;
    }
</script>

{#if show}
    <div
        class="fixed inset-0 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-md z-100 flex items-start justify-center p-4"
        onclick={(e) => e.target === e.currentTarget && handleCancel()}
        onkeydown={(e) => e.key === "Escape" && handleCancel()}
        role="presentation"
        transition:fade={{ duration: 200 }}
    >
        <div
            class="bg-card text-card-foreground border rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl relative my-auto border-zinc-200 dark:border-zinc-800"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <div class="p-8 text-center space-y-6">
                <!-- Icon based on type -->
                <div class="flex justify-center">
                    {#if type === "danger"}
                        <div
                            class="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400"
                        >
                            <Trash2 size={40} />
                        </div>
                    {:else if type === "warning"}
                        <div
                            class="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400"
                        >
                            <AlertTriangle size={40} />
                        </div>
                    {:else}
                        <div
                            class="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400"
                        >
                            <Info size={40} />
                        </div>
                    {/if}
                </div>

                <div class="space-y-2">
                    <h2
                        class="text-2xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white"
                    >
                        {title}
                    </h2>
                    <p
                        class="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed px-4"
                    >
                        {message}
                    </p>
                </div>
            </div>

            <div
                class="p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-4"
            >
                <Button
                    variant="ghost"
                    onclick={handleCancel}
                    class="flex-1 h-16 rounded-2xl font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
                >
                    {cancelLabel}
                </Button>
                <Button
                    variant={type === "danger"
                        ? "destructive"
                        : type === "warning"
                          ? "default"
                          : "default"}
                    onclick={handleConfirm}
                    class="flex-1 h-16 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl {type ===
                    'danger'
                        ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                        : type === 'warning'
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                          : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}"
                >
                    {confirmLabel}
                </Button>
            </div>
        </div>
    </div>
{/if}
