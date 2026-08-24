<script lang="ts">
    import { page } from "$app/stores";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import { initialsAvatarDataUri } from "$lib/utils/initials-avatar";
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { browser } from "$app/environment";
    import {
        LayoutDashboard,
        Users,
        Compass,
        Settings,
        LogOut,
        Menu,
        X,
        ChevronRight,
        Shield as ShieldIcon,
        MessageSquare,
        Navigation,
        Trophy,
        Gem,
        Swords,
        Smartphone,
        KeyRound,
        ShieldCheck,
    } from "lucide-svelte";

    let { data, children } = $props();

    let sidebarOpen = $state(false);
    // Force light mode only
    let theme = $state<"light" | "dark">("light");

    const navItems = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        {
            href: "/dashboard/users",
            label: "Utenti",
            icon: Users,
            adminOnly: true,
        },
        {
            href: "/dashboard/teams",
            label: "Teams",
            icon: ShieldIcon,
            adminOnly: true,
        },
        {
            href: "/dashboard/player-credentials",
            label: "Credenziali giocatori",
            icon: KeyRound,
            adminOnly: true,
        },
        {
            href: "/dashboard/accesses",
            label: "Accessi",
            icon: ShieldCheck,
            adminOnly: true,
        },
        { href: "/dashboard/events", label: "Eventi", icon: Compass },
        {
            href: "/dashboard/messages",
            label: "Messaggi",
            icon: MessageSquare,
            adminOnly: true,
        },
        { href: "/dashboard/settings", label: "Impostazioni", icon: Settings },
    ];

    $effect(() => {
        if (browser) {
            // Always light mode
            document.documentElement.classList.remove("dark");
        }
    });

    function isActive(href: string): boolean {
        if (href === "/dashboard" || href === "/dashboard/") {
            return (
                $page.url.pathname === "/dashboard" ||
                $page.url.pathname === "/dashboard/"
            );
        }
        return $page.url.pathname.startsWith(href);
    }
</script>

<svelte:head>
    <script>
        // Force light mode
        (function () {
            document.documentElement.classList.remove("dark");
        })();
    </script>
</svelte:head>

<div
    class="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors duration-300"
>
    <!-- Mobile Menu Button -->
    <button
        onclick={() => (sidebarOpen = !sidebarOpen)}
        class="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-sm"
    >
        {#if sidebarOpen}
            <X size={20} />
        {:else}
            <Menu size={20} />
        {/if}
    </button>

    <!-- Sidebar Overlay (Mobile) -->
    {#if sidebarOpen}
        <div
            class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onclick={() => (sidebarOpen = false)}
            onkeydown={() => {}}
            role="button"
            tabindex="-1"
        ></div>
    {/if}

    <div class="shadcn-theme flex w-full">
        <!-- Sidebar -->
        <aside
            class="fixed inset-y-0 left-0 h-screen w-64 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 z-45 flex flex-col
			{sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0"
        >
            <!-- Logo -->
            <div
                class="h-16 shrink-0 flex items-center gap-3 px-4 border-b border-zinc-200 dark:border-zinc-800"
            >
                <div
                    class="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20"
                >
                    <LayoutDashboard size={20} class="text-white" />
                </div>
                <span class="font-bold tracking-tight text-lg">PAAA Tool</span>
            </div>

            <!-- Navigation -->
            <nav class="flex-1 min-h-0 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                {#each navItems as item}
                    {#if !item.adminOnly || data.user?.role === "admin"}
                        <a
                            href={item.href}
                            onclick={() => (sidebarOpen = false)}
                            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold text-sm group {isActive(
                                item.href,
                            )
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        >
                            <item.icon
                                size={20}
                                class="transition-colors {isActive(item.href)
                                    ? 'text-primary-foreground'
                                    : 'group-hover:text-foreground'}"
                            />
                            <span>{item.label}</span>
                            {#if isActive(item.href)}
                                <ChevronRight size={16} class="ml-auto" />
                            {/if}
                        </a>

                        {#if item.label === "Eventi" && $page.data.event}
                            <!-- Dynamic Event Sub-menu in Sidebar -->
                            <div class="pl-4 mt-1 mb-2 space-y-1 border-l-2 border-zinc-200 dark:border-zinc-800 ml-6">
                                <p class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-3 py-1">
                                    {$page.data.event.name}
                                </p>
                                <a
                                    href={`/dashboard/${$page.data.event.slug}`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && !$page.url.searchParams.get('tab')
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'}"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && !$page.url.searchParams.get('tab') ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                    Overview
                                </a>
                                <a
                                    href={`/dashboard/${$page.data.event.slug}?tab=factions`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'factions'
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'}"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'factions' ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                    Fazioni
                                </a>
                                <a
                                    href={`/dashboard/${$page.data.event.slug}?tab=program`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'program'
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'}"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'program' ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                    Programma
                                </a>
                                <a
                                    href={`/dashboard/${$page.data.event.slug}?tab=challenges`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'challenges'
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'}"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'challenges' ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                    Giochi
                                </a>
                                <a
                                    href={`/dashboard/${$page.data.event.slug}?tab=codex`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'codex'
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'}"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'codex' ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                    Codex Janara
                                </a>
                                <a
                                    href={`/dashboard/${$page.data.event.slug}?tab=phase3`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'phase3'
                                        ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200'
                                        : 'text-muted-foreground hover:bg-cyan-50 dark:hover:bg-cyan-950/30 hover:text-cyan-800 dark:hover:text-cyan-200'}"
                                >
                                    <Swords size={12} class={$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'phase3' ? 'text-cyan-600' : 'text-zinc-400'} />
                                    Fase 3
                                </a>
                                <a
                                    href={`/dashboard/${$page.data.event.slug}?tab=phase4`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'phase4'
                                        ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200'
                                        : 'text-muted-foreground hover:bg-yellow-50 dark:hover:bg-yellow-950/30 hover:text-yellow-800 dark:hover:text-yellow-200'}"
                                >
                                    <Gem size={12} class={$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'phase4' ? 'text-yellow-600' : 'text-zinc-400'} />
                                    Fase 4
                                </a>
                                {#if data.user?.role === "admin"}
                                    <a
                                        href={`/dashboard/${$page.data.event.slug}?tab=scores`}
                                        onclick={() => (sidebarOpen = false)}
                                        class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                        {$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'scores'
                                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                            : 'text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'}"
                                    >
                                        <Trophy size={12} class={$page.url.pathname === `/dashboard/${$page.data.event.slug}` && $page.url.searchParams.get('tab') === 'scores' ? 'text-blue-600' : 'text-zinc-400'} />
                                        Imposta Punti
                                    </a>
                                {/if}
                                <a
                                    href={`/dashboard/${$page.data.event.slug}/geophase`}
                                    onclick={() => (sidebarOpen = false)}
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                    {$page.url.pathname.startsWith(`/dashboard/${$page.data.event.slug}/geophase`)
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                        : 'text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'}"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full {$page.url.pathname.startsWith(`/dashboard/${$page.data.event.slug}/geophase`) ? 'bg-blue-600' : 'bg-transparent'}"></span>
                                    GeoPhase
                                </a>
                            </div>
                        {/if}
                    {/if}
                {/each}
            </nav>

            <!-- Bottom Section -->
            <div
                class="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-sm"
            >
                {#if data.user?.role === "admin"}
                    <a
                        href="/staff"
                        onclick={() => (sidebarOpen = false)}
                        class="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-600/20 transition-all active:scale-[0.98]"
                    >
                        <Smartphone size={18} />
                        Modalità Giudice
                    </a>
                {/if}
                <!-- User Info Card -->
                <div
                    class="flex items-center gap-3 p-3 bg-card text-card-foreground rounded-2xl border shadow-sm transition-all hover:shadow-md"
                >
                    <div class="relative">
                        <img
                            src={getAvatarUrl(
                                data.user?.avatarUrl,
                                data.user?.id || "user",
                                "user",
                            )}
                            alt="Avatar"
                            onerror={(e) => {
                                const target =
                                    e.currentTarget as HTMLImageElement;
                                target.src = initialsAvatarDataUri(data.user?.name || data.user?.email || "U");
                            }}
                            class="w-10 h-10 rounded-xl object-cover border shadow-sm"
                        />
                        <div
                            class="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"
                        ></div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold truncate text-foreground">
                            {data.user?.name ||
                                data.user?.email?.split("@")[0] ||
                                "Utente"}
                        </p>
                        <p
                            class="text-[10px] text-muted-foreground font-medium truncate"
                        >
                            {data.user?.email}
                        </p>
                    </div>
                    <form action="/logout" method="POST" use:enhance>
                        <button
                            type="submit"
                            class="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </form>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="lg:pl-64 min-h-screen w-full">
            {@render children()}
        </main>
    </div>
</div>
