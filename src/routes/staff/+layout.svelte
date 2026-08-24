<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { LayoutDashboard, LogOut, Target } from "lucide-svelte";

    let { children, data } = $props();
</script>

<div class="light min-h-screen bg-zinc-50 flex flex-col selection:bg-amber-100">
    <!-- Mobile Header -->
    <header
        class="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 px-6 h-20 flex items-center justify-between shadow-sm"
    >
        <a href="/staff" class="flex items-center gap-3">
            <div
                class="w-10 h-10 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-600/20"
            >
                <Target size={24} />
            </div>
            <span
                class="font-black text-xl tracking-tighter uppercase italic text-zinc-950"
                >Staff</span
            >
        </a>

        <div class="flex items-center gap-2 sm:gap-4">
            {#if data.user?.role === "admin"}
                <a
                    href="/dashboard"
                    class="h-11 px-3 sm:px-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
                    title="Passa alla Dashboard desktop"
                >
                    <LayoutDashboard size={19} />
                    <span class="hidden md:inline">Desktop</span>
                </a>
            {/if}
            <div class="hidden sm:flex flex-col items-end mr-1">
                <span
                    class="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none mb-1"
                    >{data.user?.role === "admin" ? "ADMIN" : "STAFF"}</span
                >
                <span class="text-base font-black leading-none text-zinc-950"
                    >{data.user?.name || "Staff"}</span
                >
            </div>
            <form action="/logout" method="POST">
                <Button
                    variant="ghost"
                    size="icon"
                    type="submit"
                    class="h-12 w-12 rounded-2xl hover:bg-zinc-100 text-zinc-500"
                    aria-label="Esci"
                >
                    <LogOut size={22} />
                </Button>
            </form>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col">
        {@render children()}
    </main>

    <!-- Bottom Nav (Optional for later) -->
</div>
