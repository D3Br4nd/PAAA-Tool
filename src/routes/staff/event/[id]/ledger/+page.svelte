<script lang="ts">
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import {
        ChevronLeft,
        Trash2,
        Trophy,
        Clock,
        User,
        Target,
        AlertCircle,
    } from "lucide-svelte";

    let { data } = $props();

    function formatTime(ms: any) {
        return new Date(ms).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function formatDate(ms: any) {
        return new Date(ms).toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "short",
        });
    }
</script>

<div class="p-6 space-y-8 pb-32">
    <div class="flex items-center gap-6">
        <Button
            variant="ghost"
            size="icon"
            href="/staff/event/{data.eventId}"
            class="h-14 w-14 rounded-2xl shrink-0 hover:bg-zinc-50 border-2 border-zinc-100"
        >
            <ChevronLeft size={28} />
        </Button>
        <div class="min-w-0">
            <h2
                class="text-3xl font-black tracking-tight text-zinc-950 uppercase italic leading-none"
            >
                Registro
            </h2>
            <p
                class="text-sm font-black text-zinc-400 uppercase tracking-widest mt-1"
            >
                Ultime Valutazioni
            </p>
        </div>
    </div>

    {#if data.entries.length === 0}
        <div
            class="p-16 text-center bg-white rounded-xl border-4 border-dashed border-zinc-100 flex flex-col items-center"
        >
            <div
                class="w-20 h-20 bg-zinc-50 rounded-xl flex items-center justify-center mb-6"
            >
                <AlertCircle size={40} class="text-zinc-300" />
            </div>
            <h3 class="font-black text-xl mb-2 text-zinc-950">
                Nessun Punteggio
            </h3>
            <p class="text-sm text-zinc-500 font-bold max-w-[200px]">
                Inizia a valutare le squadre per vedere la cronologia qui.
            </p>
        </div>
    {:else}
        <div class="space-y-4">
            {#each data.entries as entry}
                <Card.Card
                    class="p-6 rounded-xl border-2 border-zinc-100 bg-white shadow-sm overflow-hidden relative group"
                >
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-white shrink-0"
                            >
                                <Trophy size={18} />
                            </div>
                            <div>
                                <h4
                                    class="font-black text-lg uppercase text-zinc-950 leading-none"
                                >
                                    {entry.teamName}
                                </h4>
                                <div class="flex items-center gap-2 mt-1">
                                    <span
                                        class="text-[10px] font-black uppercase text-amber-600 tracking-widest"
                                        >{entry.challengeName}</span
                                    >
                                    <span class="text-[10px] text-zinc-300"
                                        >•</span
                                    >
                                    <span
                                        class="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-1"
                                    >
                                        <Clock size={10} />
                                        {formatTime(entry.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div
                            class="text-2xl font-black italic {entry.points > 0
                                ? 'text-green-600'
                                : 'text-red-600'}"
                        >
                            {entry.points > 0 ? "+" : ""}{entry.points}<span
                                class="text-sm ml-0.5">PT</span
                            >
                        </div>
                    </div>

                    <div class="p-4 bg-zinc-50 rounded-2xl mb-4">
                        <p
                            class="text-xs font-bold text-zinc-600 italic leading-relaxed"
                        >
                            {entry.description}
                        </p>
                        <div
                            class="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-100"
                        >
                            <User size={12} class="text-zinc-400" />
                            <span
                                class="text-[10px] font-black uppercase text-zinc-400"
                                >Giudice: {entry.judgeName || "N/A"}</span
                            >
                        </div>
                    </div>

                    <div class="flex justify-end border-t border-zinc-50 pt-4">
                        <form method="POST" action="?/deleteEntry" use:enhance>
                            <input type="hidden" name="id" value={entry.id} />
                            <Button
                                variant="ghost"
                                type="submit"
                                class="h-12 px-6 rounded-xl text-red-600 font-black uppercase text-[10px] tracking-widest hover:bg-red-50 active:scale-95"
                            >
                                <Trash2 size={16} class="mr-2" /> Annulla
                            </Button>
                        </form>
                    </div>
                </Card.Card>
            {/each}
        </div>
    {/if}
</div>
