<script lang="ts">
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import {
        constellationAvatarUrl,
        parseConstellationAvatarSeed,
    } from "$lib/utils/constellation-avatar";
    import { initialsAvatarDataUri } from "$lib/utils/initials-avatar";
    import * as Card from "$lib/components/ui/card";
    import {
        Users,
        Plus,
        Pencil,
        Trash2,
        X,
        Upload,
        RefreshCw,
        Paperclip,
        UserPlus,
        UserCog,
        KeyRound,
        Copy,
        Check,
        ChevronRight,
        ShieldCheck,
        Shield as ShieldIcon,
    } from "lucide-svelte";

    let { data, form } = $props();

    // Dialog state
    let showDialog = $state(false);
    let editingTeam = $state<(typeof data.teams)[0] | null>(null);
    let isSubmitting = $state(false);

    type GeneratedCredentials = {
        teamId: string;
        teamName: string;
        password: string;
        accounts: Array<{ id: string; name: string; username: string }>;
    };

    // Player-account management
    let managedTeamId = $state<string | null>(null);
    let generatedCredentials = $state<GeneratedCredentials | null>(null);
    let isProvisioning = $state(false);
    let showProvisionDialog = $state(false);
    let provisionForm = $state<HTMLFormElement | null>(null);
    let provisionMessage = $state("");
    let provisionConfirmed = false;
    let savingPlayerId = $state<string | null>(null);
    let credentialsCopied = $state(false);
    const managedTeam = $derived(
        data.teams.find((team) => team.id === managedTeamId) || null,
    );
    const managedPlayers = $derived(
        managedTeam?.members.filter((member) => member.role === "player") || [],
    );

    // Avatar preview
    let avatarPreview = $state<string | null>(null);
    let avatarInput = $state<HTMLInputElement | null>(null);
    let avatarSeed = $state("");
    let avatarVariantBase = $state("team");
    const avatarVariants = $derived(() =>
        Array.from({ length: 6 }, (_, index) =>
            index === 0
                ? avatarVariantBase
                : `${avatarVariantBase}-${index + 1}`,
        ),
    );

    // Member selection
    let selectedMemberIds = $state<string[]>([]);

    // Deletion state
    let showDeleteDialog = $state(false);
    let teamToDelete = $state<(typeof data.teams)[0] | null>(null);

    function createAvatarSeed(): string {
        if (typeof globalThis.crypto?.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }

        return `team-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function selectConstellationAvatar(seed: string) {
        avatarSeed = seed;
        avatarPreview = constellationAvatarUrl(seed);
        if (avatarInput) avatarInput.value = "";
    }

    function regenerateAvatarVariants() {
        avatarVariantBase = createAvatarSeed();
        selectConstellationAvatar(avatarVariantBase);
    }

    function openCreateDialog() {
        editingTeam = null;
        avatarVariantBase = createAvatarSeed();
        avatarSeed = avatarVariantBase;
        avatarPreview = constellationAvatarUrl(avatarSeed);
        selectedMemberIds = [];
        showDialog = true;
    }

    function openEditDialog(team: (typeof data.teams)[0]) {
        const savedSeed = parseConstellationAvatarSeed(team.avatarUrl);
        const usesConstellationFallback =
            !team.avatarUrl || team.avatarUrl.includes("api.dicebear.com");
        avatarVariantBase = savedSeed || team.id;
        avatarSeed =
            savedSeed ||
            (usesConstellationFallback ? avatarVariantBase : "");
        editingTeam = team;
        avatarPreview = usesConstellationFallback
            ? constellationAvatarUrl(avatarVariantBase)
            : team.avatarUrl;
        selectedMemberIds = team.members.map((m) => m.id);
        showDialog = true;
    }

    function closeDialog() {
        showDialog = false;
        editingTeam = null;
        avatarPreview = null;
        avatarSeed = "";
        selectedMemberIds = [];
    }

    function openPlayersDialog(team: (typeof data.teams)[0]) {
        managedTeamId = team.id;
        generatedCredentials = null;
        credentialsCopied = false;
    }

    function closePlayersDialog() {
        managedTeamId = null;
        generatedCredentials = null;
        credentialsCopied = false;
    }

    function confirmProvision(event: SubmitEvent) {
        if (provisionConfirmed) {
            provisionConfirmed = false;
            return;
        }

        event.preventDefault();
        provisionForm = event.currentTarget as HTMLFormElement;
        provisionMessage = managedPlayers.length >= 3
            ? "Verrà impostata una nuova password unica per i primi 3 account giocatore. Continuare?"
            : "Verranno creati gli account mancanti e impostata una password unica per i primi 3 giocatori. Continuare?";
        showProvisionDialog = true;
    }

    function submitProvision() {
        const form = provisionForm;
        provisionForm = null;
        if (!form) return;
        provisionConfirmed = true;
        form.requestSubmit();
    }

    function cancelProvision() {
        provisionForm = null;
    }

    async function copyCredentials() {
        if (!generatedCredentials) return;
        const rows = [
            `Squadra: ${generatedCredentials.teamName}`,
            ...generatedCredentials.accounts.map(
                (account, index) =>
                    `Giocatore ${index + 1}: ${account.username}`,
            ),
            `Password comune: ${generatedCredentials.password}`,
        ];
        await navigator.clipboard.writeText(rows.join("\n"));
        credentialsCopied = true;
        window.setTimeout(() => (credentialsCopied = false), 2000);
    }

    function triggerDelete(team: (typeof data.teams)[0]) {
        teamToDelete = team;
        showDeleteDialog = true;
    }

    function closeDeleteDialog() {
        showDeleteDialog = false;
        teamToDelete = null;
    }

    function handleAvatarChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            avatarSeed = "";
            const reader = new FileReader();
            reader.onload = () => {
                avatarPreview = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    function toggleMember(userId: string) {
        if (selectedMemberIds.includes(userId)) {
            selectedMemberIds = selectedMemberIds.filter((id) => id !== userId);
        } else {
            selectedMemberIds = [...selectedMemberIds, userId];
        }
    }

    let deleteForm: HTMLFormElement;
</script>

<div class="p-6 lg:p-8 w-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-10">
        <div>
            <h1
                class="text-3xl font-extrabold flex items-center gap-3 text-zinc-900 dark:text-white"
            >
                <ShieldIcon size={32} class="text-blue-600" />
                Gestione Teams
            </h1>
            <p class="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">
                Organizza i partecipanti in squadre e gestisci i loro file
            </p>
        </div>
        <Button
            onclick={openCreateDialog}
            class="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-6 shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
        >
            <Plus size={20} class="mr-2" />
            Nuovo Team
        </Button>
    </div>

    <!-- Error/Success -->
    {#if form?.error}
        <div
            class="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 flex items-center gap-3"
        >
            <X size={20} />
            {form.error}
        </div>
    {/if}

    <!-- Teams Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each data.teams as team (team.id)}
            <Card.Card
                class="overflow-hidden flex flex-col shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl group border"
            >
                <!-- Header Section -->
                <div class="p-6 border-b bg-muted/30">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex items-center gap-4 min-w-0">
                            <div class="relative shrink-0">
                                <img
                                    src={getAvatarUrl(
                                        team.avatarUrl,
                                        team.id,
                                        "team",
                                    )}
                                    alt={team.name}
                                    class="w-14 h-14 rounded-2xl object-cover bg-background border shadow-sm transition-transform group-hover:scale-105"
                                    onerror={(e) => {
                                        const target =
                                            e.currentTarget as HTMLImageElement;
                                        target.src = initialsAvatarDataUri(team.name || "T");
                                    }}
                                />
                                <div
                                    class="absolute -bottom-1 -right-1 bg-green-500 w-3.5 h-3.5 rounded-full border-2 border-background shadow-sm"
                                ></div>
                            </div>
                            <div class="min-w-0">
                                <h3
                                    class="text-xl font-black leading-tight truncate text-foreground"
                                >
                                    {team.name || "Senza Nome"}
                                </h3>
                                <div class="flex items-center gap-2 mt-1.5">
                                    <span
                                        class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70"
                                        >Join Code:</span
                                    >
                                    <code
                                        class="text-[10px] font-mono font-black bg-primary/10 px-2 py-0.5 rounded-lg text-primary border border-primary/20"
                                    >
                                        {team.joinCode}
                                    </code>
                                </div>
                            </div>
                        </div>
                        <div
                            class="flex flex-col gap-1 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                onclick={() => openEditDialog(team)}
                                class="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                                <Pencil size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onclick={() => triggerDelete(team)}
                                class="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    </div>
                </div>

                <div class="p-5 flex-1 space-y-5">
                    {#if team.description}
                        <p
                            class="text-muted-foreground text-xs leading-relaxed italic line-clamp-2 bg-muted/30 p-3 rounded-2xl border border-border/50"
                        >
                            "{team.description}"
                        </p>
                    {/if}

                    <!-- Members Section -->
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <h4
                                class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5"
                            >
                                <Users size={12} />
                                Membri
                            </h4>
                            <span
                                class="text-xs font-bold text-muted-foreground/70"
                                >{team.members.length}</span
                            >
                        </div>
                        <div class="flex -space-x-2 overflow-hidden">
                            {#each team.members.slice(0, 5) as member}
                                <img
                                    src={getAvatarUrl(
                                        (member as any)?.avatarUrl,
                                        (member as any)?.name || "User",
                                        "user",
                                    )}
                                    alt={(member as any)?.name || "User"}
                                    class="inline-block h-8 w-8 rounded-full ring-2 ring-background object-cover"
                                    title={(member as any).name}
                                />
                            {/each}
                            {#if team.members.length > 5}
                                <div
                                    class="flex items-center justify-center h-8 w-8 rounded-full bg-muted ring-2 ring-background text-[10px] font-bold text-muted-foreground"
                                >
                                    +{team.members.length - 5}
                                </div>
                            {/if}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onclick={() => openPlayersDialog(team)}
                            class="w-full h-10 rounded-xl text-xs font-bold"
                        >
                            <UserCog size={15} class="mr-2" />
                            Gestisci giocatori
                        </Button>
                    </div>

                    <!-- Attachments Section -->
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <h4
                                class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5"
                            >
                                <Paperclip size={12} />
                                Allegati
                            </h4>
                            <span
                                class="text-xs font-bold text-muted-foreground/70"
                                >{team.files.length}</span
                            >
                        </div>

                        {#if team.files?.length > 0}
                            <div class="space-y-2">
                                {#each team.files as file}
                                    <div
                                        class="group/file flex items-center justify-between p-3 bg-background border rounded-2xl hover:border-primary/30 transition-all"
                                    >
                                        <div
                                            class="flex items-center gap-3 min-w-0"
                                        >
                                            <div
                                                class="p-2 bg-muted rounded-xl text-muted-foreground group-hover/file:text-primary transition-colors"
                                            >
                                                <Paperclip size={14} />
                                            </div>
                                            <span
                                                class="text-xs font-medium truncate text-foreground"
                                                >{file.name}</span
                                            >
                                        </div>
                                        <form
                                            action="?/deleteFile"
                                            method="POST"
                                            use:enhance
                                        >
                                            <input
                                                type="hidden"
                                                name="teamId"
                                                value={team.id}
                                            />
                                            <input
                                                type="hidden"
                                                name="filename"
                                                value={file.name}
                                            />
                                            <Button
                                                type="submit"
                                                variant="ghost"
                                                size="icon"
                                                class="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 size={12} />
                                            </Button>
                                        </form>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p
                                class="text-[10px] text-muted-foreground/60 italic text-center py-4 bg-muted/20 rounded-2xl border border-dashed"
                            >
                                Nessun file allegato
                            </p>
                        {/if}
                        <div class="pt-2">
                            <form
                                action="?/uploadFile"
                                method="POST"
                                enctype="multipart/form-data"
                                use:enhance
                            >
                                <input
                                    type="hidden"
                                    name="teamId"
                                    value={team.id}
                                />
                                <label class="block cursor-pointer">
                                    <div
                                        class="w-full h-11 rounded-2xl border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[9px]"
                                    >
                                        <Upload size={14} />
                                        Carica File
                                    </div>
                                    <input
                                        type="file"
                                        name="files"
                                        multiple
                                        onchange={(e) =>
                                            (
                                                e.target as HTMLInputElement
                                            ).form?.requestSubmit()}
                                        class="hidden"
                                    />
                                </label>
                            </form>
                        </div>
                    </div>
                </div>
            </Card.Card>
        {/each}
    </div>

    {#if data.teams.length === 0}
        <div
            class="text-center py-24 bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm"
        >
            <div
                class="bg-blue-50 dark:bg-blue-950/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
            >
                <Users size={48} class="text-blue-600 dark:text-blue-400" />
            </div>
            <h2
                class="text-3xl font-extrabold mb-3 text-zinc-900 dark:text-white"
            >
                Nessun Team Creato
            </h2>
            <p
                class="text-zinc-500 dark:text-zinc-400 mb-10 text-lg max-w-md mx-auto"
            >
                Crea la prima squadra e inizia ad aggiungere partecipanti ed
                allegati.
            </p>
            <Button
                onclick={openCreateDialog}
                class="bg-blue-600 hover:bg-blue-700 px-10 py-7 text-lg font-bold text-white rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-105"
            >
                Crea il Primo Team
            </Button>
        </div>
    {/if}
</div>

<!-- Player accounts dialog -->
{#if managedTeamId && managedTeam}
    <div
        class="fixed inset-0 bg-zinc-950/70 backdrop-blur-md z-50 flex items-start justify-center p-4"
        onclick={(event: MouseEvent) =>
            event.target === event.currentTarget && closePlayersDialog()}
        onkeydown={(event: KeyboardEvent) =>
            event.key === "Escape" && closePlayersDialog()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div class="bg-card border rounded-2xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl my-auto">
            <div class="flex items-start justify-between gap-4 p-6 border-b bg-muted/30">
                <div>
                    <h2 class="text-2xl font-black">Giocatori · {managedTeam.name}</h2>
                    <p class="text-sm text-muted-foreground mt-1">
                        Crea tre accessi rapidi o modifica i giocatori già associati.
                    </p>
                </div>
                <Button variant="ghost" size="icon" onclick={closePlayersDialog} class="rounded-xl">
                    <X size={22} />
                </Button>
            </div>

            <div class="p-6 space-y-6">
                {#if form?.error}
                    <div class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        {form.error}
                    </div>
                {/if}

                <section class="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h3 class="font-black flex items-center gap-2">
                                <KeyRound size={18} class="text-primary" /> Tre account rapidi
                            </h3>
                            <p class="text-xs text-muted-foreground mt-1 max-w-xl">
                                Riutilizza i giocatori presenti, crea solo quelli mancanti e assegna ai primi tre una password temporanea comune.
                            </p>
                        </div>
                        <form
                            action="?/provisionPlayers"
                            method="POST"
                            onsubmit={confirmProvision}
                            use:enhance={() => {
                                isProvisioning = true;
                                return async ({ result, update }) => {
                                    if (result.type === "success") {
                                        const payload = result.data as { credentials?: GeneratedCredentials };
                                        if (payload.credentials) generatedCredentials = payload.credentials;
                                    }
                                    await update({ reset: false });
                                    isProvisioning = false;
                                };
                            }}
                            class="w-full md:w-auto md:min-w-[430px] space-y-3"
                        >
                            <input type="hidden" name="teamId" value={managedTeam.id} />
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {#each [1, 2, 3] as slot}
                                    <label class="space-y-1 text-[10px] font-bold uppercase text-muted-foreground">
                                        Username {slot}
                                        <input
                                            type="text"
                                            name={`username${slot}`}
                                            value={managedPlayers[slot - 1]?.username || ""}
                                            minlength="3"
                                            maxlength="32"
                                            pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
                                            placeholder={`${managedTeam.joinCode.toLowerCase()}-${slot}`}
                                            autocomplete="off"
                                            autocapitalize="none"
                                            spellcheck="false"
                                            class="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono normal-case text-foreground"
                                        />
                                    </label>
                                {/each}
                            </div>
                            <label class="space-y-1 text-[10px] font-bold uppercase text-muted-foreground">
                                Password comune
                                <input
                                    type="text"
                                    name="commonPassword"
                                    minlength="8"
                                    maxlength="128"
                                    placeholder="Vuota = generata automaticamente"
                                    autocomplete="new-password"
                                    class="w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-mono normal-case text-foreground"
                                />
                            </label>
                            <Button type="submit" disabled={isProvisioning} class="w-full rounded-xl">
                                <UserPlus size={16} class="mr-2" />
                                {isProvisioning
                                    ? "Preparazione..."
                                    : managedPlayers.length >= 3
                                      ? "Rigenera credenziali"
                                      : "Crea i 3 account"}
                            </Button>
                        </form>
                    </div>

                    {#if generatedCredentials?.teamId === managedTeam.id}
                        <div class="rounded-2xl border bg-background p-4 space-y-3">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <p class="font-black">Credenziali generate</p>
                                    <p class="text-[11px] text-amber-700">Copiale ora oppure ritrovale nella schermata Credenziali giocatori.</p>
                                </div>
                                <Button type="button" variant="outline" onclick={copyCredentials} class="rounded-xl">
                                    {#if credentialsCopied}<Check size={15} class="mr-2 text-green-600" /> Copiate{:else}<Copy size={15} class="mr-2" /> Copia{/if}
                                </Button>
                            </div>
                            <div class="grid gap-2 sm:grid-cols-3">
                                {#each generatedCredentials.accounts as account, index (account.id)}
                                    <div class="rounded-xl bg-muted p-3 border">
                                        <p class="text-[10px] uppercase text-muted-foreground font-bold">Giocatore {index + 1}</p>
                                        <p class="font-mono font-black mt-1">{account.username}</p>
                                    </div>
                                {/each}
                            </div>
                            <div class="rounded-xl bg-zinc-950 text-white p-4 flex justify-between gap-3">
                                <span class="text-xs text-zinc-400 font-bold uppercase">Password comune</span>
                                <code class="text-lg font-black tracking-wider">{generatedCredentials.password}</code>
                            </div>
                        </div>
                    {/if}
                </section>

                <section class="space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-black">Dettagli giocatori</h3>
                            <p class="text-xs text-muted-foreground">Lascia vuota la password per non cambiarla.</p>
                        </div>
                        <span class="text-xs font-bold text-muted-foreground">{managedPlayers.length} associati</span>
                    </div>

                    {#if managedPlayers.length > 0}
                        <div class="grid gap-4 lg:grid-cols-2">
                            {#each managedPlayers as player, index (player.id)}
                                <form
                                    action="?/updateTeamPlayer"
                                    method="POST"
                                    use:enhance={() => {
                                        savingPlayerId = player.id;
                                        return async ({ result, update }) => {
                                            await update();
                                            savingPlayerId = null;
                                            if (result.type === "success") generatedCredentials = null;
                                        };
                                    }}
                                    class="rounded-2xl border p-5 space-y-4 bg-background"
                                >
                                    <input type="hidden" name="teamId" value={managedTeam.id} />
                                    <input type="hidden" name="userId" value={player.id} />
                                    <div class="flex items-center gap-3">
                                        <img
                                            src={getAvatarUrl(player.avatarUrl, player.name || player.id, "user")}
                                            alt=""
                                            class="h-11 w-11 rounded-xl object-cover border"
                                        />
                                        <div>
                                            <p class="text-[10px] uppercase text-muted-foreground font-black">Giocatore {index + 1}</p>
                                            <p class="text-xs text-muted-foreground">{player.hasPassword ? "Accesso attivo" : "Password da impostare"}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <label class="space-y-1 text-xs font-bold text-muted-foreground">
                                            Nome *
                                            <input type="text" name="name" required value={player.name || ""} class="w-full px-3 py-2.5 bg-background border rounded-xl text-sm text-foreground" />
                                        </label>
                                        <label class="space-y-1 text-xs font-bold text-muted-foreground">
                                            Username *
                                            <input
                                                type="text"
                                                name="username"
                                                required
                                                minlength="3"
                                                maxlength="32"
                                                pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
                                                value={player.username || ""}
                                                placeholder={`${managedTeam.joinCode.toLowerCase()}-${index + 1}`}
                                                autocomplete="off"
                                                class="w-full px-3 py-2.5 bg-background border rounded-xl text-sm font-mono text-foreground"
                                            />
                                        </label>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <label class="space-y-1 text-xs font-bold text-muted-foreground">
                                            Email facoltativa
                                            <input type="email" name="email" value={player.email || ""} autocomplete="off" class="w-full px-3 py-2.5 bg-background border rounded-xl text-sm text-foreground" />
                                        </label>
                                        <label class="space-y-1 text-xs font-bold text-muted-foreground">
                                            Nuova password
                                            <input type="password" name="password" minlength="8" placeholder="Minimo 8 caratteri" autocomplete="new-password" class="w-full px-3 py-2.5 bg-background border rounded-xl text-sm text-foreground" />
                                        </label>
                                    </div>
                                    <Button type="submit" variant="outline" disabled={savingPlayerId === player.id} class="w-full rounded-xl">
                                        {savingPlayerId === player.id ? "Salvataggio..." : "Salva giocatore"}
                                    </Button>
                                </form>
                            {/each}
                        </div>
                    {:else}
                        <div class="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                            Nessun giocatore associato. Usa “Crea i 3 account”.
                        </div>
                    {/if}
                </section>
            </div>
        </div>
    </div>
{/if}

<!-- Modal Dialog -->
{#if showDialog}
    <div
        class="fixed inset-0 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-start justify-center p-4"
        onclick={(e: MouseEvent) =>
            e.target === e.currentTarget && closeDialog()}
        onkeydown={(e: KeyboardEvent) => e.key === "Escape" && closeDialog()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div
            class="bg-card text-card-foreground border rounded-2xl w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl relative my-auto animate-in zoom-in-95 duration-200"
        >
            <div
                class="flex items-center justify-between p-8 border-b bg-muted/30"
            >
                <div>
                    <h2
                        class="text-2xl font-black text-zinc-900 dark:text-white"
                    >
                        {editingTeam ? "Modifica Squadra" : "Nuova Squadra"}
                    </h2>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Definisci i dettagli e i membri della squadra
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onclick={closeDialog}
                    class="h-12 w-12 rounded-2xl bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                >
                    <X size={24} />
                </Button>
            </div>

            <form
                action={editingTeam ? "?/update" : "?/create"}
                method="POST"
                enctype="multipart/form-data"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                        if (!form?.error) closeDialog();
                    };
                }}
                class="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
                {#if editingTeam}
                    <input type="hidden" name="id" value={editingTeam.id} />
                {/if}
                <input type="hidden" name="avatarSeed" value={avatarSeed} />

                <!-- Left Column: Basic Info -->
                <div class="space-y-6">
                    <!-- Avatar -->
                    <div class="space-y-4 py-2">
                        <div class="flex items-center justify-between gap-3">
                            <p class="text-sm font-bold text-muted-foreground">
                                Avatar Constellation
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onclick={regenerateAvatarVariants}
                                class="h-8 w-8"
                                aria-label="Genera nuove varianti"
                                title="Genera nuove varianti"
                            >
                                <RefreshCw size={16} />
                            </Button>
                        </div>
                        <div class="flex items-center gap-4">
                            <img
                                src={avatarPreview ||
                                    constellationAvatarUrl(avatarVariantBase)}
                                alt="Preview"
                                class="h-24 w-24 shrink-0 rounded-lg object-cover border shadow-lg"
                            />
                            <div class="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
                                {#each avatarVariants() as seed, index (seed)}
                                    <button
                                        type="button"
                                        onclick={() => selectConstellationAvatar(seed)}
                                        class="aspect-square min-w-0 overflow-hidden rounded-lg border-2 transition-colors {avatarSeed === seed
                                            ? 'border-blue-600 ring-2 ring-blue-600/20'
                                            : 'border-zinc-200 hover:border-zinc-400'}"
                                        aria-label={`Seleziona avatar ${index + 1}`}
                                        title={`Seleziona avatar ${index + 1}`}
                                    >
                                        <img
                                            src={constellationAvatarUrl(seed)}
                                            alt=""
                                            class="h-full w-full object-cover"
                                        />
                                    </button>
                                {/each}
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onclick={() => avatarInput?.click()}
                            class="h-10"
                        >
                            <Upload size={16} class="mr-2" />
                            Carica immagine
                        </Button>
                        <input
                            bind:this={avatarInput}
                            type="file"
                            name="avatar"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            onchange={handleAvatarChange}
                            class="hidden"
                        />
                    </div>

                    <div class="space-y-2">
                        <label
                            for="team-name"
                            class="block text-sm font-bold text-muted-foreground"
                            >Nome Squadra *</label
                        >
                        <input
                            id="team-name"
                            type="text"
                            name="name"
                            required
                            value={editingTeam?.name || ""}
                            placeholder="Es: Armata Brancaleone"
                            class="w-full px-5 py-4 bg-background border rounded-2xl focus:ring-2 focus:ring-ring outline-none transition-all font-medium text-foreground"
                        />
                    </div>

                    <div class="space-y-2">
                        <label
                            for="team-join-code"
                            class="block text-sm font-bold text-muted-foreground"
                            >Codice squadra {editingTeam
                                ? "*"
                                : "(facoltativo)"}</label
                        >
                        <input
                            id="team-join-code"
                            type="text"
                            name="joinCode"
                            value={editingTeam?.joinCode || ""}
                            required={Boolean(editingTeam)}
                            minlength="6"
                            maxlength="16"
                            pattern="[A-Za-z0-9]+"
                            placeholder="Es: FALCHI26"
                            autocomplete="off"
                            autocapitalize="characters"
                            spellcheck="false"
                            oninput={(event) => {
                                const input = event.currentTarget;
                                input.value = input.value
                                    .replace(/[^a-zA-Z0-9]/g, "")
                                    .toUpperCase();
                            }}
                            class="w-full px-5 py-4 bg-background border rounded-2xl focus:ring-2 focus:ring-ring outline-none transition-all font-mono font-black uppercase tracking-wider text-foreground"
                        />
                        <p class="text-[10px] leading-relaxed text-muted-foreground">
                            Da 6 a 16 lettere o numeri. Verrà usato come base per
                            gli username, ad esempio
                            <code class="font-bold">falchi26-1</code>.
                            {#if editingTeam}
                                Gli username già creati non vengono rinominati.
                            {/if}
                        </p>
                    </div>

                    <div class="space-y-2">
                        <label
                            for="team-desc"
                            class="block text-sm font-bold text-muted-foreground"
                            >Descrizione</label
                        >
                        <textarea
                            id="team-desc"
                            name="description"
                            rows="4"
                            placeholder="Breve introduzione alla squadra..."
                            class="w-full px-5 py-4 bg-background border rounded-2xl focus:ring-2 focus:ring-ring outline-none transition-all resize-none font-medium text-foreground custom-scrollbar"
                            >{editingTeam?.description || ""}</textarea
                        >
                    </div>
                </div>

                <!-- Right Column: Members Selection -->
                <div class="flex flex-col h-full">
                    <p
                        class="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
                    >
                        Seleziona Membri
                    </p>
                    <div
                        class="flex-1 overflow-y-auto max-h-[480px] border-2 border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 p-3 space-y-2 custom-scrollbar"
                    >
                        {#each data.users as user (user.id)}
                            <button
                                type="button"
                                onclick={() => toggleMember(user.id)}
                                class="w-full flex items-center gap-4 p-3.5 rounded-2xl text-left transition-all relative overflow-hidden group/member
									{selectedMemberIds.includes(user.id)
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'hover:bg-white dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'}"
                            >
                                <div class="relative">
                                    <img
                                        src={getAvatarUrl(
                                            user.avatarUrl,
                                            user.name ||
                                                (user as any).email ||
                                                "User",
                                            "user",
                                        )}
                                        alt=""
                                        class="w-10 h-10 rounded-xl"
                                    />
                                    {#if selectedMemberIds.includes(user.id)}
                                        <div
                                            class="absolute -top-1 -right-1 bg-white text-blue-600 rounded-full p-0.5 border-2 border-blue-600"
                                        >
                                            <ShieldCheck size={10} />
                                        </div>
                                    {/if}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-xs font-black truncate">
                                        {user.name}
                                    </p>
                                    <p
                                        class="text-[9px] opacity-70 uppercase tracking-widest font-bold mt-0.5"
                                    >
                                        {user.role}
                                    </p>
                                </div>
                                {#if selectedMemberIds.includes(user.id)}
                                    <ChevronRight size={18} />
                                {:else if user.teamId && user.teamId !== editingTeam?.id}
                                    <div
                                        class="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-lg text-[8px] font-black uppercase tracking-tighter"
                                    >
                                        In altro team
                                    </div>
                                {/if}
                            </button>
                        {/each}
                    </div>
                    {#each selectedMemberIds as id}
                        <input type="hidden" name="memberIds" value={id} />
                    {/each}
                    <div
                        class="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20"
                    >
                        <p
                            class="text-[10px] text-blue-700 dark:text-blue-400 font-medium"
                        >
                            Tip: I membri selezionati verranno assegnati
                            automaticamente a questa squadra al momento del
                            salvataggio.
                        </p>
                    </div>
                </div>

                <!-- Action Footer -->
                <div
                    class="col-span-1 lg:col-span-2 flex gap-4 pt-8 border-t border-zinc-100 dark:border-zinc-800 mt-4"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        onclick={(e: MouseEvent) =>
                            e.target === e.currentTarget && closeDialog()}
                        onkeydown={(e: KeyboardEvent) =>
                            e.key === "Escape" && closeDialog()}
                        role="presentation"
                        class="flex-1 py-7 rounded-2xl text-lg font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        disabled={isSubmitting}
                    >
                        Annulla
                    </Button>
                    <Button
                        type="submit"
                        class="flex-1 py-7 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-lg font-black shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02]"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? "Salvataggio..."
                            : editingTeam
                              ? "Salva Modifiche"
                              : "Crea Squadra"}
                    </Button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Custom Delete Confirmation Dialog -->
<ConfirmDialog
    bind:show={showProvisionDialog}
    title="Rigenera credenziali"
    message={provisionMessage}
    confirmLabel="Continua"
    type="warning"
    onConfirm={submitProvision}
    onCancel={cancelProvision}
/>

<ConfirmDialog
    bind:show={showDeleteDialog}
    title="Elimina Team"
    message={`Sei sicuro di voler eliminare il team ${teamToDelete?.name}? Tutti i dati associati verranno rimossi. Questa azione non può essere annullata.`}
    confirmLabel="Elimina Team"
    type="danger"
    onConfirm={() => deleteForm.requestSubmit()}
/>

<form
    action="?/delete"
    method="POST"
    use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => {
            await update();
            isSubmitting = false;
            showDeleteDialog = false;
        };
    }}
    bind:this={deleteForm}
    class="hidden"
>
    {#if teamToDelete}
        <input type="hidden" name="id" value={teamToDelete.id} />
    {/if}
</form>

<style>
    /* Custom scrollbar refinements */
    .custom-scrollbar::-webkit-scrollbar {
        width: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #e4e4e7; /* zinc-200 */
        border-radius: 20px;
        border: 1px solid transparent;
        background-clip: padding-box;
    }
    :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #3f3f46; /* zinc-700 */
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #d4d4d8; /* zinc-300 */
    }
    :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #52525b; /* zinc-600 */
    }
</style>
