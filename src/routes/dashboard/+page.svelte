<script lang="ts">
    import {
        Users,
        Compass,
        Shield,
        TrendingUp,
        Settings,
        Target,
        ListChecks,
        Gamepad2,
    } from "lucide-svelte";
    import * as Card from "$lib/components/ui/card";

    let { data } = $props();
</script>

<div class="p-6 lg:p-8 w-full">
    <header class="mb-8">
        <h1 class="text-3xl font-bold">
            Benvenuto, {data.user?.name || data.user?.email?.split("@")[0]}
        </h1>
        <p class="text-zinc-500 dark:text-zinc-400 mt-1">
            Ecco una panoramica del sistema PAAA-Tool.
        </p>
    </header>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
        <Card.Card
            class="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        >
            <Card.CardHeader
                class="flex flex-row items-center justify-between pb-2"
            >
                <Card.CardTitle
                    class="text-sm font-medium text-zinc-500 dark:text-zinc-400"
                >
                    Admin
                </Card.CardTitle>
                <Shield size={16} class="text-zinc-400 dark:text-zinc-500" />
            </Card.CardHeader>
            <Card.CardContent>
                <div class="text-2xl font-bold">{data.stats.admins}</div>
                <p class="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    Account amministratori
                </p>
            </Card.CardContent>
        </Card.Card>

        <Card.Card
            class="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        >
            <Card.CardHeader
                class="flex flex-row items-center justify-between pb-2"
            >
                <Card.CardTitle
                    class="text-sm font-medium text-zinc-500 dark:text-zinc-400"
                >
                    Giocatori
                </Card.CardTitle>
                <Users size={16} class="text-zinc-400 dark:text-zinc-500" />
            </Card.CardHeader>
            <Card.CardContent>
                <div class="text-2xl font-bold">{data.stats.players}</div>
                <p class="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    Totale partecipanti
                </p>
            </Card.CardContent>
        </Card.Card>

        <Card.Card
            class="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        >
            <Card.CardHeader
                class="flex flex-row items-center justify-between pb-2"
            >
                <Card.CardTitle
                    class="text-sm font-medium text-zinc-500 dark:text-zinc-400"
                >
                    Staff
                </Card.CardTitle>
                <Shield size={16} class="text-zinc-400 dark:text-zinc-500" />
            </Card.CardHeader>
            <Card.CardContent>
                <div class="text-2xl font-bold">{data.stats.staff}</div>
                <p class="text-xs text-zinc-500 mt-1">
                    Organizzatori e assistenti
                </p>
            </Card.CardContent>
        </Card.Card>

        <Card.Card
            class="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        >
            <Card.CardHeader
                class="flex flex-row items-center justify-between pb-2"
            >
                <Card.CardTitle
                    class="text-sm font-medium text-zinc-500 dark:text-zinc-400"
                >
                    Squadre
                </Card.CardTitle>
                <Compass size={16} class="text-zinc-400 dark:text-zinc-500" />
            </Card.CardHeader>
            <Card.CardContent>
                <div class="text-2xl font-bold">{data.stats.teams}</div>
                <p class="text-xs text-zinc-500 mt-1 italic">
                    Iscritte ai tornei
                </p>
            </Card.CardContent>
        </Card.Card>

        <Card.Card
            class="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        >
            <Card.CardHeader
                class="flex flex-row items-center justify-between pb-2"
            >
                <Card.CardTitle
                    class="text-sm font-medium text-zinc-500 dark:text-zinc-400"
                >
                    Eventi Attivi
                </Card.CardTitle>
                <TrendingUp
                    size={16}
                    class="text-zinc-400 dark:text-zinc-500"
                />
            </Card.CardHeader>
            <Card.CardContent>
                <div
                    class="text-2xl font-bold text-green-600 dark:text-green-500"
                >
                    {data.stats.activeEvents}
                </div>
                <p class="text-xs text-green-600 dark:text-green-500 mt-1">
                    Edizioni in corso
                </p>
            </Card.CardContent>
        </Card.Card>
    </div>

    <!-- Quick Actions -->
    <h2 class="text-xl font-semibold mb-4">Azioni Rapide</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
            href="/dashboard/users"
            class="group p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                >
                    <Users size={24} />
                </div>
                <div>
                    <h3 class="font-semibold">Gestione Utenti</h3>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                        Crea e modifica account
                    </p>
                </div>
            </div>
        </a>

        <a
            href="/dashboard/events"
            class="group p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:border-green-500 dark:hover:border-green-500 hover:shadow-lg hover:shadow-green-500/10 transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-600 group-hover:text-white transition-colors"
                >
                    <TrendingUp size={24} />
                </div>
                <div>
                    <h3 class="font-semibold">Gestione Eventi</h3>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                        Crea e configura gli eventi
                    </p>
                </div>
            </div>
        </a>

        <a
            href="/dashboard/teams"
            class="group p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/10 transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-colors"
                >
                    <Shield size={24} />
                </div>
                <div>
                    <h3 class="font-semibold">Gestione Teams</h3>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                        Organizza squadre e file
                    </p>
                </div>
            </div>
        </a>

        <a
            href="/staff"
            class="group p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/10 transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors"
                >
                    <Target size={24} />
                </div>
                <div>
                    <h3 class="font-semibold">App Giudici (PWA)</h3>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                        Punteggi sul campo
                    </p>
                </div>
            </div>
        </a>

        <a
            href="/game"
            class="group p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors"
                >
                    <Gamepad2 size={24} />
                </div>
                <div>
                    <h3 class="font-semibold">App Giocatori (PWA)</h3>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                        Esperienza lato squadra
                    </p>
                </div>
            </div>
        </a>

        <a
            href="/dashboard/settings"
            class="group p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors"
                >
                    <Settings size={24} />
                </div>
                <div>
                    <h3 class="font-semibold">Impostazioni</h3>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                        Configura il sistema
                    </p>
                </div>
            </div>
        </a>
    </div>
</div>
