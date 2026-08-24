<script lang="ts">
    import { enhance } from "$app/forms";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import {
        MessageSquare,
        Send,
        Users,
        Flag,
        Compass,
        X,
        Search,
        Trash2,
        Pencil,
        FileCode,
        Download,
        AlertCircle,
        History,
        User,
        Filter,
        ChevronLeft,
        ChevronRight as ChevronRightIcon,
        CalendarClock,
    } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page as sveltePage } from "$app/stores";

    let { data, form } = $props();

    let activeTab = $state("teams"); // "teams" or "players"
    let searchTerm = $state("");
    let selectedTeam = $state<any>(null);
    let selectedPlayer = $state<any>(null);
    let selectedTeamForHistory = $state<any>(null);
    let messageToEdit = $state<any>(null);
    let isBroadcast = $state(false);
    let messageContent = $state("");
    let messageExpiresAt = $state("");
    let isSubmitting = $state(false);

    const teamById = $derived(
        new Map((data.teams || []).map((team: any) => [team.id, team])),
    );
    const playerById = $derived(
        new Map(
            (data.messagePlayers || []).map((player: any) => [
                player.id,
                player,
            ]),
        ),
    );

    const filteredTeams = $derived(
        data.teams.filter(
            (t: any) =>
                t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.factionName
                    ?.toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                t.eventName?.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    );

    const totalPages = $derived(
        Math.ceil((data.totalPlayers || 0) / (data.pageSize || 10)),
    );

    const visiblePages = $derived.by(() => {
        const total = totalPages;
        const current = data.currentPage || 1;
        const maxVisible = 5;

        if (total <= maxVisible) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        let start = Math.max(1, current - 2);
        let end = Math.min(total, start + 4);

        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }

        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    });

    function changePage(newPage: number) {
        if (newPage < 1 || newPage > totalPages) return;
        const url = new URL($sveltePage.url);
        url.searchParams.set("page", newPage.toString());
        goto(url.toString(), { keepFocus: true });
    }

    function handleTeamFilter(teamId: string) {
        const url = new URL($sveltePage.url);
        if (teamId === "all") {
            url.searchParams.delete("teamId");
        } else {
            url.searchParams.set("teamId", teamId);
        }
        url.searchParams.set("page", "1");
        goto(url.toString(), { keepFocus: true });
    }

    function openMessageModal(
        target: any,
        targetType: "team" | "player" | "broadcast",
    ) {
        if (targetType === "team") {
            selectedTeam = target;
            selectedPlayer = null;
            isBroadcast = false;
        } else if (targetType === "player") {
            selectedPlayer = target;
            selectedTeam = null;
            isBroadcast = false;
        } else if (targetType === "broadcast") {
            selectedTeam = null;
            selectedPlayer = null;
            isBroadcast = true;
        }
        messageContent = "";
        messageExpiresAt = "";
        messageToEdit = null;
    }

    function openEditModal(msg: any) {
        messageToEdit = msg;
        messageContent = msg.content;
        selectedTeam =
            data.teams.find((t: any) => t.id === msg.recipientTeamId) || null;
        selectedPlayer =
            data.messagePlayers.find((p: any) => p.id === msg.recipientId) ||
            null;
        isBroadcast = msg.isBroadcast;
        messageExpiresAt = toDateTimeLocal(msg.expiresAt);
    }

    function closeMessageModal() {
        selectedTeam = null;
        selectedPlayer = null;
        messageToEdit = null;
        isBroadcast = false;
        messageExpiresAt = "";
    }

    function openHistoryModal(team: any) {
        selectedTeamForHistory = team;
    }

    function closeHistoryModal() {
        selectedTeamForHistory = null;
    }

    const teamMessages = $derived(
        (data.messages || []).filter((m: any) =>
            selectedTeamForHistory
                ? m.recipientTeamId === selectedTeamForHistory.id ||
                  m.isBroadcast
                : false,
        ),
    );

    function toDateTimeLocal(value: string | number | Date | null | undefined) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }

    function formatDateTime(value: string | number | Date | null | undefined) {
        if (!value) return "Nessuna";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Nessuna";
        return date.toLocaleString();
    }

    function getMessageTarget(msg: any) {
        if (msg.isBroadcast) return "Tutti";
        if (msg.recipientTeamId) {
            return teamById.get(msg.recipientTeamId)?.name || "Team eliminato";
        }
        if (msg.recipientId) {
            return (
                playerById.get(msg.recipientId)?.name ||
                playerById.get(msg.recipientId)?.email ||
                "Giocatore eliminato"
            );
        }
        return "Nessun destinatario";
    }

    function getMessageTargetMeta(msg: any) {
        if (msg.isBroadcast) return "Broadcast globale";
        if (msg.recipientTeamId) {
            const team = teamById.get(msg.recipientTeamId);
            return [team?.eventName, team?.factionName].filter(Boolean).join(" - ");
        }
        if (msg.recipientId) {
            return playerById.get(msg.recipientId)?.teamName || "Senza Team";
        }
        return "";
    }

    function isExpired(msg: any) {
        return msg.expiresAt && new Date(msg.expiresAt).getTime() <= Date.now();
    }
</script>

<div class="p-6 lg:p-12 w-full space-y-10">
    <!-- Header -->
    <div class="flex items-center justify-between gap-6 pb-6 border-b">
        <div class="flex items-center gap-4">
            <div
                class="bg-indigo-600/10 p-3 rounded-2xl border border-indigo-600/20"
            >
                <MessageSquare size={32} class="text-indigo-600" />
            </div>
            <div>
                <h1 class="text-3xl font-black tracking-tight uppercase">
                    Messaggi di Gioco
                </h1>
                <p class="text-zinc-500 font-medium">
                    Invia avvisi e comunicazioni alle squadre
                </p>
            </div>
        </div>
        <Button
            onclick={() => openMessageModal(null, "broadcast")}
            class="rounded-2xl h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all active:scale-95"
        >
            <AlertCircle size={20} class="mr-2" />
            Broadcast a tutti
        </Button>
    </div>

    <!-- Published Messages -->
    <section class="space-y-4">
        <div class="flex items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-black tracking-tight">
                    Messaggi Pubblicati
                </h2>
                <p class="text-sm text-zinc-500 font-medium">
                    Apri un messaggio per modificarne contenuto, destinatario informativo e scadenza.
                </p>
            </div>
        </div>

        <Card.Card class="rounded-2xl border-2 overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-muted/50 border-b">
                            <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                                Tipo
                            </th>
                            <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                                Destinatario
                            </th>
                            <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                                Messaggio
                            </th>
                            <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                                Pubblicato
                            </th>
                            <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                                Scadenza
                            </th>
                            <th class="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                                Azioni
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-border/50">
                        {#each data.messages as msg (msg.id)}
                            <tr class="hover:bg-muted/30 transition-colors">
                                <td class="px-6 py-4">
                                    <span
                                        class="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest {msg.isBroadcast
                                            ? 'bg-amber-500/10 text-amber-600'
                                            : msg.recipientTeamId
                                              ? 'bg-indigo-600/10 text-indigo-600'
                                              : 'bg-emerald-500/10 text-emerald-600'}"
                                    >
                                        {msg.isBroadcast
                                            ? "Broadcast"
                                            : msg.recipientTeamId
                                              ? "Team"
                                              : "Player"}
                                    </span>
                                </td>
                                <td class="px-6 py-4">
                                    <p class="font-bold">{getMessageTarget(msg)}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {getMessageTargetMeta(msg)}
                                    </p>
                                </td>
                                <td class="px-6 py-4 max-w-md">
                                    <p class="text-sm font-medium line-clamp-2">
                                        {msg.content}
                                    </p>
                                    {#if msg.attachmentName}
                                        <p class="text-xs text-indigo-600 font-bold mt-1">
                                            Allegato: {msg.attachmentName}
                                        </p>
                                    {/if}
                                </td>
                                <td class="px-6 py-4 text-sm font-medium text-muted-foreground">
                                    {formatDateTime(msg.sentAt)}
                                </td>
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-2">
                                        <CalendarClock size={16} class={isExpired(msg) ? "text-red-500" : "text-zinc-400"} />
                                        <div>
                                            <p class="text-sm font-bold {isExpired(msg) ? 'text-red-600' : ''}">
                                                {formatDateTime(msg.expiresAt)}
                                            </p>
                                            {#if isExpired(msg)}
                                                <p class="text-[10px] font-black uppercase tracking-widest text-red-500">
                                                    Scaduto
                                                </p>
                                            {/if}
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4">
                                    <div class="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onclick={() => openEditModal(msg)}
                                            class="rounded-xl font-bold h-10 px-4"
                                        >
                                            <Pencil size={16} class="mr-2" />
                                            Apri
                                        </Button>
                                        <form
                                            action="?/deleteMessage"
                                            method="POST"
                                            use:enhance
                                        >
                                            <input type="hidden" name="id" value={msg.id} />
                                            <Button
                                                type="submit"
                                                variant="ghost"
                                                size="icon"
                                                class="h-10 w-10 rounded-xl hover:text-red-500"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        {:else}
                            <tr>
                                <td colspan="6" class="px-8 py-16 text-center">
                                    <div class="flex flex-col items-center gap-4 opacity-50">
                                        <MessageSquare size={40} />
                                        <p class="font-bold uppercase tracking-widest text-[10px]">
                                            Nessun messaggio pubblicato
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </Card.Card>
    </section>

    <!-- Tabs & Filters -->
    <div
        class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
    >
        <div class="flex bg-muted/50 p-1.5 rounded-xl border border-border/50">
            <button
                onclick={() => (activeTab = "teams")}
                class="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all
                {activeTab === 'teams'
                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600'
                    : 'text-muted-foreground hover:text-foreground'}"
            >
                Squadre
            </button>
            <button
                onclick={() => (activeTab = "players")}
                class="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all
                {activeTab === 'players'
                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600'
                    : 'text-muted-foreground hover:text-foreground'}"
            >
                Giocatori
            </button>
        </div>

        <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <!-- Search -->
            <div class="relative group flex-1 md:w-64">
                <Search
                    size={18}
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-600 transition-colors"
                />
                <input
                    type="text"
                    bind:value={searchTerm}
                    placeholder={activeTab === "teams"
                        ? "Cerca squadra..."
                        : "Cerca giocatore..."}
                    class="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all text-sm font-medium"
                />
            </div>

            {#if activeTab === "players"}
                <!-- Team Filter -->
                <div class="relative flex-1 md:w-64">
                    <Filter
                        size={18}
                        class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <select
                        value={data.teamFilter || "all"}
                        onchange={(e) =>
                            handleTeamFilter(e.currentTarget.value)}
                        class="w-full h-11 pl-11 pr-10 bg-muted/30 border border-border/50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all text-sm font-medium appearance-none cursor-pointer"
                    >
                        <option value="all">Tutti i Team</option>
                        {#each data.teams as team}
                            <option value={team.id}>{team.name}</option>
                        {/each}
                    </select>
                </div>
            {/if}
        </div>
    </div>

    <!-- Content Table -->
    <Card.Card class="rounded-2xl border-2 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-muted/50 border-b">
                        {#if activeTab === "teams"}
                            <th
                                class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                                >Squadra</th
                            >
                            <th
                                class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                                >Fazione</th
                            >
                            <th
                                class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                                >Evento</th
                            >
                        {:else}
                            <th
                                class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                                >Giocatore</th
                            >
                            <th
                                class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                                >Team</th
                            >
                            <th
                                class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                                >Email</th
                            >
                        {/if}
                        <th
                            class="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                            >Azioni</th
                        >
                    </tr>
                </thead>
                <tbody class="divide-y divide-border/50">
                    {#if activeTab === "teams"}
                        {#each filteredTeams as team (team.id)}
                            <tr
                                class="hover:bg-muted/30 transition-colors group"
                            >
                                <td class="px-8 py-5">
                                    <div class="flex items-center gap-4">
                                        <div
                                            class="w-12 h-12 rounded-2xl overflow-hidden border bg-zinc-100 shrink-0"
                                        >
                                            <img
                                                src={getAvatarUrl(
                                                    team.avatarUrl,
                                                    team.name,
                                                    "team",
                                                )}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span
                                            class="font-bold text-lg tracking-tight"
                                            >{team.name}</span
                                        >
                                    </div>
                                </td>
                                <td class="px-8 py-5">
                                    <div class="flex items-center gap-2">
                                        <Flag
                                            size={16}
                                            class="text-muted-foreground"
                                        />
                                        <span
                                            class="font-semibold text-zinc-600 dark:text-zinc-400"
                                            >{team.factionName ||
                                                "Nessuna"}</span
                                        >
                                    </div>
                                </td>
                                <td class="px-8 py-5">
                                    <div class="flex items-center gap-2">
                                        <Compass
                                            size={16}
                                            class="text-muted-foreground"
                                        />
                                        <span
                                            class="font-semibold text-zinc-600 dark:text-zinc-400"
                                            >{team.eventName || "Nessuno"}</span
                                        >
                                    </div>
                                </td>
                                <td
                                    class="px-8 py-5 text-right flex gap-2 justify-end"
                                >
                                    <Button
                                        onclick={() => openHistoryModal(team)}
                                        variant="ghost"
                                        size="sm"
                                        class="rounded-xl font-bold h-10 px-4 hover:bg-muted transition-all"
                                    >
                                        <History size={16} class="mr-2" />
                                        Cronologia
                                    </Button>
                                    <Button
                                        onclick={() =>
                                            openMessageModal(team, "team")}
                                        variant="outline"
                                        size="sm"
                                        class="rounded-xl font-bold h-10 px-4 hover:bg-indigo-600 hover:text-white transition-all border-zinc-200 dark:border-zinc-800"
                                    >
                                        <Send size={16} class="mr-2" />
                                        Invia
                                    </Button>
                                </td>
                            </tr>
                        {:else}
                            <tr>
                                <td colspan="4" class="px-8 py-20 text-center">
                                    <div
                                        class="flex flex-col items-center gap-4 opacity-50"
                                    >
                                        <Users size={40} />
                                        <p class="font-bold">
                                            Nessuna squadra trovata
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    {:else}
                        {#each data.players as player (player.id)}
                            <tr
                                class="hover:bg-muted/30 transition-colors group"
                            >
                                <td class="px-8 py-5">
                                    <div class="flex items-center gap-4">
                                        <div
                                            class="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 overflow-hidden border"
                                        >
                                            <img
                                                src={getAvatarUrl(
                                                    player.avatarUrl,
                                                    player.name || "Player",
                                                    "user",
                                                )}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span
                                            class="font-bold text-lg tracking-tight"
                                            >{player.name}</span
                                        >
                                    </div>
                                </td>
                                <td class="px-8 py-5">
                                    <div class="flex items-center gap-2">
                                        <Users
                                            size={16}
                                            class="text-muted-foreground"
                                        />
                                        <span
                                            class="font-semibold text-zinc-600 dark:text-zinc-400"
                                            >{player.teamName ||
                                                "Senza Team"}</span
                                        >
                                    </div>
                                </td>
                                <td class="px-8 py-5">
                                    <span
                                        class="text-sm font-medium text-muted-foreground"
                                        >{player.email || "N/A"}</span
                                    >
                                </td>
                                <td
                                    class="px-8 py-5 text-right flex gap-2 justify-end"
                                >
                                    <Button
                                        onclick={() =>
                                            openMessageModal(player, "player")}
                                        variant="outline"
                                        size="sm"
                                        class="rounded-xl font-bold h-10 px-4 hover:bg-indigo-600 hover:text-white transition-all border-zinc-200 dark:border-zinc-800"
                                    >
                                        <Send size={16} class="mr-2" />
                                        Invia
                                    </Button>
                                </td>
                            </tr>
                        {:else}
                            <tr>
                                <td colspan="4" class="px-8 py-20 text-center">
                                    <div
                                        class="flex flex-col items-center gap-4 opacity-50"
                                    >
                                        <Users size={40} />
                                        <p class="font-bold">
                                            Nessun giocatore trovato
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>

        {#if activeTab === "players" && totalPages > 1}
            <div
                class="p-6 border-t bg-muted/10 flex items-center justify-between"
            >
                <p
                    class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"
                >
                    Pagina {data.currentPage || 1} di {totalPages}
                </p>
                <div class="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={(data.currentPage || 1) === 1}
                        onclick={() => changePage((data.currentPage || 1) - 1)}
                        class="rounded-xl"
                    >
                        <ChevronLeft size={20} />
                    </Button>
                    <div class="flex items-center gap-1">
                        {#each visiblePages as p}
                            <button
                                onclick={() => changePage(p)}
                                class="w-8 h-8 rounded-lg text-xs font-black transition-all
                                {(data.currentPage || 1) === p
                                    ? 'bg-indigo-600 text-white'
                                    : 'hover:bg-muted text-muted-foreground'}"
                            >
                                {p}
                            </button>
                        {/each}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={(data.currentPage || 1) === totalPages}
                        onclick={() => changePage((data.currentPage || 1) + 1)}
                        class="rounded-xl"
                    >
                        <ChevronRightIcon size={20} />
                    </Button>
                </div>
            </div>
        {/if}
    </Card.Card>
</div>

<!-- Send / Edit Message Modal -->
{#if selectedTeam || isBroadcast || messageToEdit}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 transition-all"
        onclick={closeMessageModal}
        onkeydown={(e) => e.key === "Escape" && closeMessageModal()}
        role="button"
        tabindex="0"
    >
        <Card.Card
            class="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto rounded-2xl shadow-2xl border-none animate-in zoom-in-95"
            onclick={(e: MouseEvent) => e.stopPropagation()}
            role="presentation"
        >
            <div
                class="p-8 border-b bg-muted/30 flex items-center justify-between"
            >
                <div class="flex items-center gap-4">
                    {#if isBroadcast}
                        <div
                            class="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white"
                        >
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <h2 class="text-xl font-black">
                                Broadcast Globale
                            </h2>
                            <p
                                class="text-xs text-muted-foreground font-bold uppercase tracking-widest"
                            >
                                A tutte le squadre
                            </p>
                        </div>
                    {:else if selectedTeam}
                        <div
                            class="w-12 h-12 rounded-2xl overflow-hidden border"
                        >
                            <img
                                src={getAvatarUrl(
                                    selectedTeam.avatarUrl,
                                    selectedTeam.name,
                                    "team",
                                )}
                                alt=""
                                class="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h2 class="text-xl font-black">
                                {messageToEdit
                                    ? "Modifica Messaggio"
                                    : `Messaggio a ${selectedTeam.name}`}
                            </h2>
                            <p
                                class="text-xs text-muted-foreground font-bold uppercase tracking-widest"
                            >
                                {selectedTeam.factionName}
                            </p>
                        </div>
                    {:else if selectedPlayer}
                        <div
                            class="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center border overflow-hidden"
                        >
                            <img
                                src={getAvatarUrl(
                                    selectedPlayer.avatarUrl,
                                    selectedPlayer.name,
                                    "user",
                                )}
                                alt=""
                                class="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h2 class="text-xl font-black">
                                {messageToEdit
                                    ? "Modifica Messaggio"
                                    : `Messaggio a ${selectedPlayer.name}`}
                            </h2>
                            <p
                                class="text-xs text-muted-foreground font-bold uppercase tracking-widest"
                            >
                                {selectedPlayer.teamName || "Senza Team"}
                            </p>
                        </div>
                    {/if}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onclick={closeMessageModal}
                    class="rounded-2xl"
                >
                    <X size={24} />
                </Button>
            </div>

            <form
                action={messageToEdit
                    ? "?/updateMessage"
                    : isBroadcast
                      ? "?/sendBroadcast"
                      : "?/sendMessage"}
                method="POST"
                enctype="multipart/form-data"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update, result }) => {
                        await update();
                        isSubmitting = false;
                        if (result.type === "success") {
                            closeMessageModal();
                        }
                    };
                }}
                class="p-8 space-y-6"
            >
                {#if messageToEdit}
                    <input type="hidden" name="id" value={messageToEdit.id} />
                {:else if isBroadcast}
                    <!-- No teamId or recipientId -->
                {:else if selectedTeam}
                    <input
                        type="hidden"
                        name="teamId"
                        value={selectedTeam.id}
                    />
                {:else if selectedPlayer}
                    <input
                        type="hidden"
                        name="recipientId"
                        value={selectedPlayer.id}
                    />
                {/if}

                <div class="space-y-2">
                    <label
                        for="message-content"
                        class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                    >
                        Contenuto del Messaggio
                    </label>
                    <textarea
                        id="message-content"
                        name="content"
                        bind:value={messageContent}
                        required
                        placeholder="Scrivi qui..."
                        class="w-full h-40 px-5 py-4 bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all resize-none font-medium"
                    ></textarea>
                </div>

                <div class="space-y-2">
                    <label
                        for="expires-at"
                        class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                    >
                        Scadenza Messaggio
                    </label>
                    <input
                        id="expires-at"
                        name="expiresAt"
                        type="datetime-local"
                        bind:value={messageExpiresAt}
                        class="w-full h-12 px-5 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all font-medium"
                    />
                    <p class="text-xs text-muted-foreground ml-1">
                        Lascia vuoto per mantenerlo sempre visibile.
                    </p>
                </div>

                {#if !messageToEdit}
                    <div class="space-y-2">
                        <label
                            for="attachment"
                            class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                        >
                            Allegato (Opzionale)
                        </label>
                        <div class="relative group">
                            <input
                                type="file"
                                id="attachment"
                                name="attachment"
                                class="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <div
                                class="w-full h-14 px-5 flex items-center gap-3 bg-muted/30 border border-border/50 rounded-2xl group-hover:border-indigo-600 transition-all font-medium text-sm text-muted-foreground"
                            >
                                <FileCode size={20} class="text-indigo-600" />
                                <span>Scegli un file o trascinalo qui</span>
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="flex gap-4">
                    <Button
                        type="button"
                        variant="ghost"
                        onclick={closeMessageModal}
                        class="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest"
                    >
                        Annulla
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting || !messageContent}
                        class="flex-1 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                    >
                        {isSubmitting
                            ? "Salvataggio..."
                            : messageToEdit
                              ? "Salva Modifiche"
                              : "Invia ora"}
                    </Button>
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- History Modal -->
{#if selectedTeamForHistory}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 transition-all"
        onclick={closeHistoryModal}
        onkeydown={(e) => e.key === "Escape" && closeHistoryModal()}
        role="button"
        tabindex="0"
    >
        <Card.Card
            class="w-full max-w-2xl rounded-2xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[calc(100dvh-2rem)] my-auto"
            onclick={(e: MouseEvent) => e.stopPropagation()}
            role="presentation"
        >
            <div
                class="p-8 border-b bg-muted/30 flex items-center justify-between shrink-0"
            >
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl overflow-hidden border">
                        <img
                            src={getAvatarUrl(
                                selectedTeamForHistory.avatarUrl,
                                selectedTeamForHistory.name,
                                "team",
                            )}
                            alt=""
                            class="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <h2 class="text-xl font-black">Cronologia Messaggi</h2>
                        <p
                            class="text-xs text-muted-foreground font-bold uppercase tracking-widest"
                        >
                            {selectedTeamForHistory.name}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onclick={closeHistoryModal}
                    class="rounded-2xl"
                >
                    <X size={24} />
                </Button>
            </div>

            <div
                class="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-50 dark:bg-zinc-950/20"
            >
                {#each teamMessages as msg (msg.id)}
                    <div
                        class="group relative bg-white dark:bg-white/5 p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md"
                    >
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex items-center gap-2">
                                {#if msg.isBroadcast}
                                    <span
                                        class="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                        >Broadcast</span
                                    >
                                {:else}
                                    <span
                                        class="px-2 py-0.5 bg-indigo-600/10 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                        >Diretto</span
                                    >
                                {/if}
                                <span
                                    class="text-[10px] font-bold text-muted-foreground"
                                >
                                    {new Date(msg.sentAt).toLocaleString()}
                                </span>
                            </div>
                            <div
                                class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="h-8 w-8 rounded-xl"
                                    onclick={() => openEditModal(msg)}
                                >
                                    <Pencil size={14} class="text-zinc-500" />
                                </Button>
                                <form
                                    action="?/deleteMessage"
                                    method="POST"
                                    use:enhance
                                >
                                    <input
                                        type="hidden"
                                        name="id"
                                        value={msg.id}
                                    />
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        class="h-8 w-8 rounded-xl hover:text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </form>
                            </div>
                        </div>
                        <p class="text-sm font-medium leading-relaxed mb-4">
                            {msg.content}
                        </p>
                        {#if msg.attachmentUrl}
                            <a
                                href={msg.attachmentUrl}
                                target="_blank"
                                class="inline-flex items-center gap-3 p-3 px-4 bg-muted/50 rounded-2xl border border-border/50 hover:bg-indigo-600 hover:text-white transition-all group/file"
                            >
                                <FileCode
                                    size={18}
                                    class="text-indigo-600 group-hover/file:text-white"
                                />
                                <span
                                    class="text-xs font-bold truncate max-w-[200px]"
                                    >{msg.attachmentName}</span
                                >
                                <Download size={14} />
                            </a>
                        {/if}
                    </div>
                {:else}
                    <div class="text-center py-12 opacity-50">
                        <MessageSquare size={40} class="mx-auto mb-4" />
                        <p
                            class="font-bold uppercase tracking-widest text-[10px]"
                        >
                            Nessun messaggio inviato
                        </p>
                    </div>
                {/each}
            </div>
        </Card.Card>
    </div>
{/if}
