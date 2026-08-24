<script lang="ts">
    import { getAvatarUrl } from "$lib/utils/avatar";
    import { initialsAvatarDataUri } from "$lib/utils/initials-avatar";
    import {
        Rocket,
        Trophy,
        MapPin,
        MessageCircle,
        Sun,
        Moon,
        LogOut,
        Shield,
        FileCode,
        Download,
        AlertCircle,
        Navigation,
        X,
        Clock,
    } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";

    let { data }: { data: any } = $props();
    const team = $derived(data.team);
    const messages = $derived(data.messages || []);
    const isOperatorPreview = $derived(data.isOperatorPreview === true);
    const codexLink = $derived(data.codexLink);
    const hasFaction = $derived(Boolean(team?.factionId));

    let theme = $state<"light" | "dark">("dark");
    let selectedMessage = $state<any>(null);
    let currentTime = $state(new Date());

    $effect(() => {
        if (browser) {
            const savedTheme =
                document.cookie.match(/theme=(dark|light)/)?.[1] || "dark";
            theme = savedTheme as "light" | "dark";
            document.documentElement.classList.toggle("dark", theme === "dark");
        }
    });

    onMount(() => {
        const clockInterval = setInterval(() => {
            currentTime = new Date();
        }, 1000);

        return () => clearInterval(clockInterval);
    });

    function toggleTheme() {
        theme = theme === "dark" ? "light" : "dark";
        if (browser) {
            document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
            document.documentElement.classList.toggle("dark", theme === "dark");
        }
    }

    function messagePreview(content: string) {
        return content.length > 150 ? `${content.substring(0, 150)}...` : content;
    }

    function formatClockTime(date: Date) {
        return date.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    }
</script>

<div
    class="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col transition-colors duration-300"
>
    <header
        class="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10"
    >
        <div class="flex items-center gap-3">
            <div
                class="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20"
            >
                <Rocket class="text-white" size={20} />
            </div>
            <span class="font-black text-lg tracking-tight uppercase"
                >{isOperatorPreview ? "CaTE PWA Preview" : "CaTE PWA"}</span
            >
        </div>
        <div class="flex items-center gap-2">
            <button
                onclick={toggleTheme}
                class="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-bold"
                aria-label="Toggle Theme"
            >
                {#if theme === "dark"}
                    <Sun size={20} class="text-amber-400" />
                {:else}
                    <Moon size={20} class="text-slate-600" />
                {/if}
            </button>
            <form action="/logout" method="POST">
                <Button
                    variant="ghost"
                    size="icon"
                    type="submit"
                    class="rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all"
                >
                    <LogOut size={20} />
                </Button>
            </form>
        </div>
    </header>

    <main class="flex-1 max-w-2xl w-full mx-auto p-6 space-y-8">
        <div
            class="bg-amber-600 rounded-2xl p-7 text-white shadow-2xl shadow-amber-600/20 relative overflow-hidden group"
        >
            <div
                class="absolute -right-10 -top-10 opacity-10 group-hover:rotate-12 transition-transform duration-700"
            >
                <Clock size={180} />
            </div>

            <div class="relative z-10 flex flex-col items-center">
                <span
                    class="text-[10px] font-black uppercase tracking-[0.4em] text-amber-200 mb-2"
                    >Orologio di Sistema</span
                >
                <div
                    class="text-5xl sm:text-6xl font-black tabular-nums tracking-tighter mb-2 drop-shadow-lg"
                >
                    {formatClockTime(currentTime)}
                </div>
                <span
                    class="text-[10px] font-bold text-amber-200/70 uppercase tracking-widest"
                >
                    {currentTime.toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                    })}
                </span>
            </div>
        </div>

        <!-- Team Card -->
        <div
            class="p-8 rounded-2xl bg-indigo-600 text-white shadow-2xl shadow-indigo-600/20 relative overflow-hidden group"
        >
            <div
                class="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"
            >
                <Shield size={120} />
            </div>

            <div class="relative z-10 flex items-center gap-6">
                <div
                    class="w-20 h-20 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center p-1 overflow-hidden"
                >
                    <img
                        src={getAvatarUrl(
                            team?.avatarUrl,
                            team?.id || team?.name || "Team",
                            "team",
                        )}
                        alt=""
                        onerror={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.src = initialsAvatarDataUri(team?.name || "Team");
                        }}
                        class="w-full h-full object-cover rounded-2xl"
                    />
                </div>
                <div>
                    <h2 class="text-3xl font-black tracking-tight">
                        {team?.name || "Squadra"}
                    </h2>
                    <div class="flex items-center gap-2 mt-1">
                        <span
                            class="px-2 py-0.5 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-wider"
                        >
                            {team?.factionName || "Senza Fazione"}
                        </span>
                        <div
                            class="w-2 h-2 rounded-full"
                            style="background: {team?.factionColor || '#fff'}"
                        ></div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
                <div>
                    <p
                        class="text-[10px] font-black uppercase tracking-widest opacity-60"
                    >
                        Punteggio Attuale
                    </p>
                    <p class="text-4xl font-black mt-1">{team?.score || 0}</p>
                </div>
                <div>
                    <p
                        class="text-[10px] font-black uppercase tracking-widest opacity-60"
                    >
                        Classifica
                    </p>
                    <p class="text-3xl font-black mt-1">
                        {team?.rank ? `${team.rank}` : "-"}
                    </p>
                    <p class="text-[10px] font-bold opacity-60">
                        {team?.totalTeams ? `su ${team.totalTeams}` : ""}
                    </p>
                </div>
                <div>
                    <p
                        class="text-[10px] font-black uppercase tracking-widest opacity-60"
                    >
                        Ultima fase giocata
                    </p>
                    <p class="text-base font-bold mt-2 line-clamp-2">
                        {team?.activePhaseName || team?.phaseName || "In attesa..."}
                    </p>
                </div>
            </div>
        </div>

        {#if isOperatorPreview}
            <section
                class="p-5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-900 dark:text-indigo-200"
            >
                <p class="text-sm font-bold uppercase tracking-widest">
                    Anteprima Operatore
                </p>
                <p class="text-sm mt-1 text-indigo-800/80 dark:text-indigo-200/80">
                    Stai visualizzando la PWA giocatori come {data.user.role}.
                    Le funzioni legate a una squadra reale restano disponibili solo ai player assegnati.
                </p>
            </section>
        {/if}

        {#if !isOperatorPreview && !hasFaction}
            <section
                class="p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-center"
            >
                <AlertCircle size={36} class="mx-auto text-amber-600" />
                <h3 class="mt-3 text-lg font-black text-amber-900 dark:text-amber-200">
                    Squadra in attesa di assegnazione
                </h3>
                <p class="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80">
                    Le attività dedicate saranno disponibili appena la squadra verrà associata a una fazione.
                </p>
            </section>
        {/if}

        <!-- Team activities -->
        {#if !isOperatorPreview && hasFaction}
            <div class="grid gap-4 sm:grid-cols-2">
                <a
                    href="/geophase"
                    class="group block p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/20 hover:border-emerald-500/50 shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 hover:scale-[1.01] relative overflow-hidden"
                >
                    <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Navigation size={80} />
                    </div>
                    <div class="relative z-10 flex items-center gap-5">
                        <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <Navigation size={26} class="text-emerald-400" />
                        </div>
                        <div class="flex-1">
                            <p class="font-black text-lg text-white">GeoPhase</p>
                            <p class="text-sm text-slate-400 font-medium mt-0.5">
                                Naviga verso le coordinate
                            </p>
                        </div>
                    </div>
                </a>

                <a
                    href={codexLink || undefined}
                    aria-disabled={!codexLink}
                    class="group block p-6 rounded-2xl bg-slate-900/80 border border-indigo-500/20 shadow-xl transition-all duration-300 relative overflow-hidden {codexLink ? 'hover:border-indigo-500/50 hover:shadow-indigo-500/10 hover:scale-[1.01]' : 'opacity-60 pointer-events-none'}"
                >
                    <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <FileCode size={80} />
                    </div>
                    <div class="relative z-10 flex items-center gap-5">
                        <div class="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                            <FileCode size={26} class="text-indigo-400" />
                        </div>
                        <div class="flex-1">
                            <p class="font-black text-lg text-white">Codex Janara</p>
                            <p class="text-sm text-slate-400 font-medium mt-0.5">
                                {codexLink ? "Apri l'enigma della fazione" : "Nessun codex assegnato"}
                            </p>
                        </div>
                    </div>
                </a>
            </div>
        {/if}

        <!-- Messages Section -->
        {#if data.user.authMethod === "password" && !isOperatorPreview}
            <section class="space-y-6">
                <div class="flex items-center justify-between px-2">
                    <h3 class="text-xl font-black flex items-center gap-2">
                        <MessageCircle size={24} class="text-indigo-600" />
                        Messaggi Recenti
                    </h3>
                    <span
                        class="px-3 py-1 bg-indigo-600/10 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest"
                    >
                        {messages.length} Messaggi
                    </span>
                </div>

                <div class="space-y-4">
                    {#each messages as message}
                        <button
                            type="button"
                            onclick={() => (selectedMessage = message)}
                            class="w-full text-left p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all"
                        >
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex items-center gap-2">
                                    {#if message.isBroadcast}
                                        <span
                                            class="p-1 px-2 bg-amber-500/10 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                        >
                                            Broadcast Globale
                                        </span>
                                    {:else}
                                        <span
                                            class="p-1 px-2 bg-indigo-600/10 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                        >
                                            Organizzatore
                                        </span>
                                    {/if}
                                </div>
                                <span
                                    class="text-[10px] font-bold text-slate-400"
                                >
                                    {new Date(message.sentAt).toLocaleString()}
                                </span>
                            </div>
                            <p
                                class="text-slate-700 dark:text-slate-300 font-medium leading-relaxed mb-4"
                            >
                                {messagePreview(message.content)}
                            </p>
                            {#if message.attachmentUrl}
                                <span
                                    class="inline-flex items-center gap-3 p-3 px-4 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10"
                                >
                                    <FileCode
                                        size={18}
                                        class="text-indigo-600"
                                    />
                                    <span
                                        class="text-xs font-bold truncate max-w-[200px]"
                                        >{message.attachmentName}</span
                                    >
                                    <Download size={14} />
                                </span>
                            {/if}
                        </button>
                    {:else}
                        <div
                            class="py-20 text-center bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10"
                        >
                            <MessageCircle
                                size={48}
                                class="mx-auto text-slate-300 dark:text-white/10 mb-4"
                            />
                            <p
                                class="text-slate-500 font-bold uppercase tracking-widest text-xs"
                            >
                                Nessun messaggio ricevuto
                            </p>
                        </div>
                    {/each}
                </div>
            </section>
        {:else if !isOperatorPreview}
            <section
                class="p-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-4"
            >
                <AlertCircle size={40} class="mx-auto text-amber-600" />
                <div>
                    <h3
                        class="text-lg font-bold text-amber-900 dark:text-amber-200"
                    >
                        Accesso Limitato
                    </h3>
                    <p
                        class="text-sm text-amber-800/80 dark:text-amber-400/80 mt-1"
                    >
                        {#if hasFaction}
                            Hai effettuato l'accesso tramite codice squadra. <br />
                            Codex Janara e GeoPhase sono disponibili qui sopra. Per i
                            messaggi degli organizzatori usa le credenziali personali
                            di un giocatore.
                        {:else}
                            La squadra non è ancora associata a una fazione. Le attività
                            dedicate saranno disponibili dopo l'assegnazione.
                        {/if}
                    </p>
                </div>
                <form action="/logout" method="POST">
                    <Button
                        type="submit"
                        variant="outline"
                        class="rounded-xl border-amber-500/50 hover:bg-amber-500 hover:text-white transition-all"
                    >
                        Esegui Logout
                    </Button>
                </form>
            </section>
        {/if}
    </main>
</div>

{#if selectedMessage}
    <div
        class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 flex items-start justify-center"
        role="dialog"
        aria-modal="true"
    >
        <div class="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl">
            <div class="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 p-5 flex items-start justify-between gap-4">
                <div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                        {selectedMessage.isBroadcast ? "Broadcast Globale" : "Messaggio Organizzatore"}
                    </p>
                    <p class="text-xs font-bold text-slate-500 mt-1">
                        {new Date(selectedMessage.sentAt).toLocaleString()}
                    </p>
                </div>
                <button
                    type="button"
                    onclick={() => (selectedMessage = null)}
                    class="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                    aria-label="Chiudi messaggio"
                >
                    <X size={20} />
                </button>
            </div>
            <div class="p-6 space-y-5">
                <p class="whitespace-pre-wrap text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                    {selectedMessage.content}
                </p>
                {#if selectedMessage.attachmentUrl}
                    <a
                        href={selectedMessage.attachmentUrl}
                        target="_blank"
                        class="inline-flex items-center gap-3 p-3 px-4 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-indigo-600 hover:text-white transition-all group/file"
                    >
                        <FileCode size={18} class="text-indigo-600 group-hover/file:text-white" />
                        <span class="text-xs font-bold truncate max-w-[260px]">
                            {selectedMessage.attachmentName}
                        </span>
                        <Download size={14} />
                    </a>
                {/if}
            </div>
        </div>
    </div>
{/if}
