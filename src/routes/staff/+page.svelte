<script lang="ts">
    import type { PageData } from "./$types";
    import { Calendar, ChevronRight, MapPin } from "lucide-svelte";

    export let data: PageData;
    function getEventTheme(type: string) {
        switch (type) {
            case "cate":
                return {
                    bg: "bg-amber-600",
                    hover: "hover:bg-amber-500",
                    accent: "bg-amber-400/20",
                    icon: "text-amber-100",
                    text: "text-white",
                    subtext: "text-amber-100/70",
                };
            case "mmp":
                return {
                    bg: "bg-indigo-600",
                    hover: "hover:bg-indigo-500",
                    accent: "bg-indigo-400/20",
                    icon: "text-indigo-100",
                    text: "text-white",
                    subtext: "text-indigo-100/70",
                };
            case "ere":
                return {
                    bg: "bg-emerald-600",
                    hover: "hover:bg-emerald-500",
                    accent: "bg-emerald-400/20",
                    icon: "text-emerald-100",
                    text: "text-white",
                    subtext: "text-emerald-100/70",
                };
            default:
                return {
                    bg: "bg-zinc-800",
                    hover: "hover:bg-zinc-700",
                    accent: "bg-zinc-700/50",
                    icon: "text-zinc-300",
                    text: "text-white",
                    subtext: "text-zinc-400",
                };
        }
    }
</script>

<div
    class="min-h-screen bg-zinc-50 text-zinc-950 p-6 pb-24 font-sans select-none"
>
    <header class="mb-12">
        <h1 class="text-4xl font-black uppercase tracking-tighter mb-2">
            Seleziona Evento
        </h1>
        <p class="text-zinc-500 font-bold italic text-sm">
            Scegli l'evento su cui operare oggi.
        </p>
    </header>

    <div class="grid gap-6">
        {#each data.events as event}
            {@const theme = getEventTheme(event.eventType)}
            <a
                href="/staff/event/{event.id}"
                class="group relative overflow-hidden {theme.bg} {theme.hover} rounded-2xl p-8 flex items-center justify-between active:scale-[0.98] transition-all shadow-xl shadow-zinc-200"
            >
                <!-- Background Decoration Icon -->
                <div
                    class="absolute -right-8 -bottom-8 {theme.icon} opacity-10"
                >
                    <Calendar size={180} strokeWidth={4} />
                </div>

                <div class="relative z-10 flex items-center gap-6">
                    <div
                        class="w-16 h-16 {theme.accent} rounded-xl flex items-center justify-center {theme.text} shadow-inner backdrop-blur-md"
                    >
                        <Calendar size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2
                            class="text-2xl font-black uppercase tracking-tight {theme.text}"
                        >
                            {event.name}
                        </h2>
                        <div class="flex items-center gap-4 mt-2">
                            <span
                                class="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest {theme.subtext}"
                            >
                                <MapPin size={12} strokeWidth={3} />
                                {event.slug}
                            </span>
                            <span
                                class="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest {theme.accent} {theme.text}"
                            >
                                {event.eventType}
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    class="relative z-10 w-12 h-12 rounded-2xl {theme.accent} flex items-center justify-center {theme.text} transition-all group-hover:translate-x-1"
                >
                    <ChevronRight size={24} strokeWidth={3} />
                </div>
            </a>
        {:else}
            <div
                class="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl p-10 text-center"
            >
                <p class="text-zinc-400 font-bold italic text-sm">
                    Nessun evento attivo al momento.
                </p>
            </div>
        {/each}
    </div>
</div>

<style>
    :global(body) {
        background-color: white;
    }
</style>
