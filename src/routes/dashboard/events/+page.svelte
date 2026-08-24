<script lang="ts">
    import { enhance } from "$app/forms";
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import {
        Compass,
        Plus,
        Pencil,
        Trash2,
        X,
        Users,
        Shield,
        ChevronRight,
        Calendar,
        ImagePlus,
        Flag,
    } from "lucide-svelte";

    let { data, form } = $props();

    // ========== EVENT STATE ==========
    let showEventDialog = $state(false);
    let editingEvent = $state<(typeof data.events)[0] | null>(null);
    let eventType = $state("cate");
    let classification = $state("");
    let description = $state("");
    let startDate = $state("");
    let endDate = $state("");
    let logoPreview = $state<string | null>(null);
    let logoFile = $state<File | null>(null);
    let showDeleteEventDialog = $state(false);
    let eventToDelete = $state<(typeof data.events)[0] | null>(null);

    let isSubmitting = $state(false);
    let openedEditTarget = $state<string | null>(null);

    // ========== EVENT FUNCTIONS ==========
    function openCreateEventDialog() {
        editingEvent = null;
        eventType = "cate";
        classification = "";
        description = "";
        startDate = "";
        endDate = "";
        logoPreview = null;
        logoFile = null;
        showEventDialog = true;
    }

    function openEditEventDialog(event: (typeof data.events)[0]) {
        editingEvent = event;
        eventType = event.eventType || "cate";
        classification = event.classification || "";
        description = event.description || "";
        startDate = event.startDate
            ? new Date(event.startDate).toISOString().split("T")[0]
            : "";
        endDate = event.endDate
            ? new Date(event.endDate).toISOString().split("T")[0]
            : "";
        logoPreview = event.logoUrl;
        logoFile = null;
        showEventDialog = true;
    }

    $effect(() => {
        const editTarget = $page.url.searchParams.get("edit");
        if (!editTarget || openedEditTarget === editTarget) return;

        const targetEvent = data.events.find(
            (event: (typeof data.events)[0]) =>
                event.slug === editTarget || event.id === editTarget,
        );

        if (targetEvent) {
            openedEditTarget = editTarget;
            openEditEventDialog(targetEvent);
        }
    });

    function closeEventDialog() {
        showEventDialog = false;
        editingEvent = null;
        eventType = "cate";
        classification = "";
        description = "";
        logoPreview = null;
        logoFile = null;
    }

    function triggerDeleteEvent(event: (typeof data.events)[0]) {
        eventToDelete = event;
        showDeleteEventDialog = true;
    }

    function closeDeleteEventDialog() {
        showDeleteEventDialog = false;
        eventToDelete = null;
    }

    function handleLogoChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            logoFile = input.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                logoPreview = e.target?.result as string;
            };
            reader.readAsDataURL(logoFile);
        }
    }

    // Generate slug from name
    function generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    // ========== CALENDAR HELPERS ==========
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    function getMonthsPreview(count: number) {
        const months = [];
        for (let i = 0; i < count; i++) {
            const d = new Date(currentYear, currentMonth + i, 1);
            months.push({
                name: d.toLocaleString("it-IT", { month: "long" }),
                month: d.getMonth(),
                year: d.getFullYear(),
                days: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
                firstDay: new Date(d.getFullYear(), d.getMonth(), 1).getDay(), // 0 = Sunday
            });
        }
        return months;
    }

    const monthsPreview = getMonthsPreview(12);

    function isDateInEvent(
        day: number,
        month: number,
        year: number,
        event: (typeof data.events)[0],
    ) {
        if (!event.startDate) return false;
        const d = new Date(year, month, day).getTime();
        const start = new Date(event.startDate).setHours(0, 0, 0, 0);
        const end = event.endDate
            ? new Date(event.endDate).setHours(23, 59, 59, 999)
            : new Date(event.startDate).setHours(23, 59, 59, 999);
        return d >= start && d <= end;
    }

    function getEventsForDate(day: number, month: number, year: number) {
        return data.events.filter((e) => isDateInEvent(day, month, year, e));
    }
</script>

<div class="p-6 lg:p-12 w-full">
    <!-- Header -->
    <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
    >
        <div class="flex items-center gap-4">
            <div
                class="bg-green-600/10 p-3 rounded-2xl border border-green-600/20"
            >
                <Compass size={32} class="text-green-600" />
            </div>
            <div>
                <h1
                    class="text-3xl font-black tracking-tight text-zinc-900 dark:text-white"
                >
                    Gestione Eventi
                </h1>
                <p class="text-zinc-500 dark:text-zinc-400 font-medium">
                    Crea e configura gli eventi della piattaforma
                </p>
            </div>
        </div>
        <Button
            onclick={openCreateEventDialog}
            class="h-12 px-6 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
            <Plus size={20} class="mr-2" />
            Nuovo Evento
        </Button>
    </div>

    <!-- Error/Success -->
    {#if form?.error}
        <div
            class="mb-8 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-4"
        >
            <X size={20} />
            <span class="font-bold">{form.error}</span>
        </div>
    {/if}

    <!-- ========== EVENTS GRID ========== -->
    {#if data.events.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {#each data.events as event (event.id)}
                <Card.Card
                    class="group relative overflow-hidden bg-card border-2 border-border hover:border-green-500/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-green-500/5 rounded-2xl"
                >
                    <div class="p-8 pb-32">
                        <!-- Top Info -->
                        <div
                            class="flex items-start justify-between gap-4 mb-6"
                        >
                            <div class="relative w-20 h-20 shrink-0">
                                {#if event.logoUrl}
                                    <img
                                        src={event.logoUrl}
                                        alt={event.name}
                                        class="w-full h-full object-contain drop-shadow-md"
                                    />
                                {:else}
                                    <div
                                        class="w-full h-full rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400"
                                    >
                                        <Compass size={32} />
                                    </div>
                                {/if}
                                {#if event.isActive}
                                    <div
                                        class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-card shadow-sm shadow-green-500/20"
                                        title="Evento Attivo"
                                    ></div>
                                {/if}
                            </div>

                            <div class="flex flex-col gap-2">
                                <span
                                    class="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-fit"
                                >
                                    {event.eventType === "other"
                                        ? event.classification || "ALTRO"
                                        : event.eventType}
                                </span>
                                <div
                                    class="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                                >
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onclick={() =>
                                            openEditEventDialog(event)}
                                        class="h-8 w-8 rounded-xl bg-background border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
                                    >
                                        <Pencil size={14} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onclick={() =>
                                            triggerDeleteEvent(event)}
                                        class="h-8 w-8 rounded-xl bg-background border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-zinc-800 dark:hover:bg-red-900/10 dark:hover:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <!-- Name & Slug -->
                        <div class="mb-4">
                            <h2
                                class="text-2xl font-black text-foreground line-clamp-1 mb-1"
                            >
                                {event.name}
                            </h2>
                            <div class="flex items-center justify-between">
                                <p
                                    class="text-sm font-mono text-muted-foreground flex items-center gap-1"
                                >
                                    <span class="opacity-50">/</span
                                    >{event.slug}
                                </p>
                                {#if event.startDate}
                                    <div
                                        class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                                    >
                                        <Calendar size={10} />
                                        {new Date(
                                            event.startDate,
                                        ).toLocaleDateString("it-IT", {
                                            day: "numeric",
                                            month: "short",
                                        })}
                                        {#if event.endDate && new Date(event.startDate).getTime() !== new Date(event.endDate).getTime()}
                                            - {new Date(
                                                event.endDate,
                                            ).toLocaleDateString("it-IT", {
                                                day: "numeric",
                                                month: "short",
                                            })}
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <!-- Description (if any) -->
                        {#if event.description}
                            <p
                                class="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed h-10"
                            >
                                {event.description}
                            </p>
                        {:else}
                            <p
                                class="text-sm text-muted-foreground/60 italic h-10"
                            >
                                Nessuna descrizione inserita.
                            </p>
                        {/if}
                    </div>

                    <!-- Actions & Footer -->
                    <div
                        class="absolute bottom-0 left-0 right-0 p-6 bg-linear-to-t from-zinc-50/80 dark:from-zinc-900/80 to-transparent backdrop-blur-sm border-t border-zinc-100/50 dark:border-zinc-800/50"
                    >
                        <div class="flex items-center justify-between gap-4">
                            <a
                                href="/{event.slug}"
                                target="_blank"
                                class="flex items-center gap-2 text-xs font-bold text-green-600 hover:text-green-700 transition-colors"
                            >
                                <Users size={14} />
                                PAGINA PUBBLICA
                            </a>
                            <Button
                                href="/dashboard/{event.slug}"
                                class="h-11 px-6 rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-black hover:scale-[1.02] active:scale-[0.98] transition-all flex-1 md:flex-none"
                            >
                                GESTISCI
                                <ChevronRight size={18} class="ml-1" />
                            </Button>
                        </div>
                    </div>
                </Card.Card>
            {/each}
        </div>
    {:else}
        <div
            class="p-20 border-3 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center bg-zinc-50/50 dark:bg-zinc-900/30"
        >
            <div
                class="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-xl w-24 h-24 mx-auto mb-6 flex items-center justify-center text-zinc-300 dark:text-zinc-600"
            >
                <Compass size={48} />
            </div>
            <h3 class="text-2xl font-black mb-3">Nessun Evento</h3>
            <p
                class="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto font-medium"
            >
                Inizia a creare il tuo primo evento e configura le fazioni, i
                team e i partecipanti.
            </p>
            <Button
                onclick={openCreateEventDialog}
                class="h-14 px-8 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold"
            >
                <Plus size={20} class="mr-2" />
                Crea il Primo Evento
            </Button>
        </div>
    {/if}

    <!-- ========== CALENDAR PREVIEW ========== -->
    <div class="mt-20">
        <div class="flex items-center gap-4 mb-8">
            <div
                class="bg-blue-600/10 p-3 rounded-2xl border border-blue-600/20"
            >
                <Calendar size={32} class="text-blue-600" />
            </div>
            <div>
                <h2
                    class="text-2xl font-black tracking-tight text-zinc-900 dark:text-white"
                >
                    Anteprima Calendario
                </h2>
                <p class="text-zinc-500 dark:text-zinc-400 font-medium">
                    Panoramica degli eventi nei prossimi mesi
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {#each monthsPreview as monthInfo}
                {@const monthEvents = data.events.filter((e) => {
                    if (!e.startDate) return false;
                    const start = new Date(e.startDate);
                    const end = e.endDate ? new Date(e.endDate) : start;
                    return (
                        (start.getMonth() === monthInfo.month &&
                            start.getFullYear() === monthInfo.year) ||
                        (end.getMonth() === monthInfo.month &&
                            end.getFullYear() === monthInfo.year)
                    );
                })}
                <div
                    class="bg-card border-2 border-border rounded-2xl p-6 shadow-sm"
                >
                    <h3
                        class="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-4 text-center"
                    >
                        {monthInfo.name}
                        <span class="text-muted-foreground/50"
                            >{monthInfo.year}</span
                        >
                    </h3>

                    <div
                        class="grid grid-cols-7 gap-1 text-[10px] font-black text-muted-foreground/50 mb-2 text-center"
                    >
                        <div>LU</div>
                        <div>MA</div>
                        <div>ME</div>
                        <div>GI</div>
                        <div>VE</div>
                        <div>SA</div>
                        <div>DO</div>
                    </div>

                    <div class="grid grid-cols-7 gap-1">
                        <!-- Empty slots for first day offset (adjusting for Monday start) -->
                        {#each Array((monthInfo.firstDay + 6) % 7) as _}
                            <div class="aspect-square"></div>
                        {/each}

                        {#each Array(monthInfo.days) as _, i}
                            {@const day = i + 1}
                            {@const isToday =
                                day === today.getDate() &&
                                monthInfo.month === today.getMonth() &&
                                monthInfo.year === today.getFullYear()}
                            {@const eventsOnDay = getEventsForDate(
                                day,
                                monthInfo.month,
                                monthInfo.year,
                            )}
                            <div
                                class="aspect-square flex items-center justify-center relative rounded-lg text-[11px] font-bold
                                {eventsOnDay.length > 0
                                    ? 'bg-green-600 text-white shadow-sm shadow-green-600/20'
                                    : isToday
                                      ? 'bg-blue-600/20 text-blue-600 ring-2 ring-blue-600/50'
                                      : 'bg-muted/30 text-muted-foreground/50'}"
                            >
                                {day}
                                {#if eventsOnDay.length > 0}
                                    <div
                                        class="absolute -top-1 -right-1 flex gap-0.5"
                                    >
                                        {#each eventsOnDay.slice(0, 3) as _}
                                            <div
                                                class="w-1.5 h-1.5 bg-white rounded-full ring-1 ring-green-600"
                                            ></div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>

                    <!-- Events list for this month -->
                    <div class="mt-6 space-y-2">
                        {#if monthEvents.length > 0}
                            {#each monthEvents as event}
                                <div
                                    class="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/50"
                                >
                                    <div
                                        class="w-2 h-2 rounded-full bg-green-600"
                                    ></div>
                                    <span
                                        class="text-[10px] font-black truncate"
                                        >{event.name}</span
                                    >
                                </div>
                            {/each}
                        {:else}
                            <p
                                class="text-[10px] text-muted-foreground/30 italic text-center"
                            >
                                Nessun evento
                            </p>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>

<!-- ========== EVENT MODAL ========== -->
{#if showEventDialog}
    <div
        class="fixed inset-0 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-start justify-center p-4"
        onclick={(e: MouseEvent) =>
            e.target === e.currentTarget && closeEventDialog()}
        onkeydown={(e: KeyboardEvent) =>
            e.key === "Escape" && closeEventDialog()}
        role="button"
        aria-label="Chiudi modale"
        tabindex="0"
    >
        <div
            class="bg-card text-card-foreground border rounded-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95 my-auto"
        >
            <div
                class="flex items-center justify-between p-8 border-b border-border/50"
            >
                <div class="flex items-center gap-4 text-green-600">
                    <Compass size={24} />
                    <h2 class="text-2xl font-black tracking-tight">
                        {editingEvent ? "Modifica Evento" : "Nuovo Evento"}
                    </h2>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onclick={closeEventDialog}
                    class="rounded-2xl h-10 w-10"
                >
                    <X size={24} />
                </Button>
            </div>

            <form
                action={editingEvent ? "?/updateEvent" : "?/createEvent"}
                method="POST"
                enctype="multipart/form-data"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                        if (!form?.error) closeEventDialog();
                    };
                }}
                class="p-8 space-y-6"
            >
                {#if editingEvent}
                    <input type="hidden" name="id" value={editingEvent.id} />
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label
                            for="event-name"
                            class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                        >
                            Nome Evento *
                        </label>
                        <input
                            id="event-name"
                            type="text"
                            name="name"
                            required
                            value={editingEvent?.name || ""}
                            placeholder="Es: CaTE 2026"
                            oninput={(e: Event) => {
                                const input = e.target as HTMLInputElement;
                                const slugInput = document.getElementById(
                                    "event-slug",
                                ) as HTMLInputElement;
                                if (slugInput && !editingEvent) {
                                    slugInput.value = generateSlug(input.value);
                                }
                            }}
                            class="w-full h-12 px-5 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all placeholder:text-muted-foreground/50"
                        />
                    </div>

                    <div class="space-y-2">
                        <label
                            for="event-slug"
                            class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                        >
                            Slug (URL) *
                        </label>
                        <input
                            id="event-slug"
                            type="text"
                            name="slug"
                            required
                            value={editingEvent?.slug || ""}
                            placeholder="cate-2026"
                            class="w-full h-12 px-5 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all placeholder:text-muted-foreground/50 font-mono text-sm"
                        />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label
                            for="event-start-date"
                            class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                        >
                            Data Inizio
                        </label>
                        <input
                            id="event-start-date"
                            type="date"
                            name="startDate"
                            bind:value={startDate}
                            class="w-full h-12 px-5 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all"
                        />
                    </div>

                    <div class="space-y-2">
                        <label
                            for="event-end-date"
                            class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                        >
                            Data Fine
                        </label>
                        <input
                            id="event-end-date"
                            type="date"
                            name="endDate"
                            bind:value={endDate}
                            class="w-full h-12 px-5 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div class="space-y-2">
                    <label
                        for="event-type"
                        class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                    >
                        Tipologia Evento *
                    </label>
                    <div class="relative">
                        <select
                            id="event-type"
                            name="eventType"
                            required
                            bind:value={eventType}
                            class="w-full h-12 px-5 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none appearance-none transition-all"
                        >
                            <option value="cate"
                                >CaTE - Caccia al Tesoro Evolution</option
                            >
                            <option value="mmp"
                                >MMP - Murder Mystery Party</option
                            >
                            <option value="ere"
                                >ERE - Escape Room Evolution</option
                            >
                            <option value="other">Altro...</option>
                        </select>
                        <ChevronRight
                            class="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-muted-foreground pointer-events-none"
                            size={16}
                        />
                    </div>
                </div>

                {#if eventType === "other"}
                    <div class="space-y-2 animate-in slide-in-from-top-2">
                        <label
                            for="event-classification"
                            class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                        >
                            Descrizione Tipologia *
                        </label>
                        <input
                            id="event-classification"
                            type="text"
                            name="classification"
                            required
                            bind:value={classification}
                            placeholder="Es: Torneo di Scacchi"
                            class="w-full h-12 px-5 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none transition-all"
                        />
                    </div>
                {/if}

                <div class="space-y-2">
                    <label
                        for="event-description"
                        class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                    >
                        Descrizione Pubblica
                    </label>
                    <textarea
                        id="event-description"
                        name="description"
                        bind:value={description}
                        placeholder="Descrivi l'evento per i partecipanti..."
                        class="w-full px-5 py-4 bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 outline-none min-h-[120px] resize-y transition-all placeholder:text-muted-foreground/50"
                    ></textarea>
                </div>

                <div class="space-y-2">
                    <label
                        for="event-logo-input"
                        class="block text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1"
                    >
                        Logo Evento
                    </label>
                    <div
                        class="flex items-center gap-6 p-6 bg-muted/20 border border-dashed rounded-xl"
                    >
                        <div
                            class="w-24 h-24 rounded-2xl bg-card border shadow-sm flex items-center justify-center overflow-hidden shrink-0"
                        >
                            {#if logoPreview}
                                <img
                                    src={logoPreview}
                                    alt="Preview"
                                    class="w-full h-full object-contain p-2"
                                />
                            {:else}
                                <ImagePlus
                                    class="text-muted-foreground/30"
                                    size={32}
                                />
                            {/if}
                        </div>
                        <div class="flex-1 space-y-2">
                            <input
                                id="event-logo-input"
                                type="file"
                                name="logo"
                                accept="image/*"
                                onchange={handleLogoChange}
                                class="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-green-600 file:text-white hover:file:bg-green-700 cursor-pointer"
                            />
                            <p
                                class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider"
                            >
                                Suggerito: Immagine quadrata, fondo trasparente
                                o bianco. Max 2MB.
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    class="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-2xl border border-green-100 dark:border-green-900/30"
                >
                    <input
                        type="checkbox"
                        id="event-active-check"
                        name="isActive"
                        value="true"
                        checked={editingEvent?.isActive ?? false}
                        class="w-6 h-6 rounded-lg border-2 border-green-200 dark:border-green-900 text-green-600 focus:ring-green-500 transition-all cursor-pointer"
                    />
                    <label
                        for="event-active-check"
                        class="font-black text-sm text-green-700 dark:text-green-400 cursor-pointer"
                    >
                        EVENTO ATTIVO E VISIBILE
                    </label>
                </div>

                <div class="flex gap-3 pt-6">
                    <Button
                        type="button"
                        variant="ghost"
                        onclick={closeEventDialog}
                        class="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest"
                    >
                        Annulla
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        class="flex-1 h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all"
                    >
                        {isSubmitting
                            ? "Salvataggio..."
                            : editingEvent
                              ? "Aggiorna Evento"
                              : "Crea Evento"}
                    </Button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- ========== DELETE EVENT DIALOG ========== -->
{#if showDeleteEventDialog && eventToDelete}
    <div
        class="fixed inset-0 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-md z-60 flex items-start justify-center p-4"
        onclick={(e: MouseEvent) =>
            e.target === e.currentTarget && closeDeleteEventDialog()}
        onkeydown={(e: KeyboardEvent) =>
            e.key === "Escape" && closeDeleteEventDialog()}
        role="button"
        aria-label="Chiudi avviso eliminazione"
        tabindex="0"
    >
        <div
            class="bg-card text-card-foreground border rounded-2xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto shadow-2xl animate-in zoom-in-95 p-8 text-center"
        >
            <div
                class="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-6"
            >
                <Trash2 size={40} />
            </div>
            <h2 class="text-2xl font-black mb-3 text-foreground">
                Elimina Evento?
            </h2>
            <p class="text-muted-foreground text-sm mb-8 leading-relaxed">
                Stai per eliminare <span class="font-bold text-foreground"
                    >"{eventToDelete.name}"</span
                >. Questa azione è irreversibile e cancellerà tutte le fazioni e
                i team associati.
            </p>

            <form
                action="?/deleteEvent"
                method="POST"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                        if (!form?.error) closeDeleteEventDialog();
                    };
                }}
                class="flex flex-col gap-3"
            >
                <input type="hidden" name="id" value={eventToDelete.id} />
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={isSubmitting}
                    class="h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all"
                >
                    {isSubmitting
                        ? "Eliminando..."
                        : "Sì, Elimina Definitivamente"}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onclick={closeDeleteEventDialog}
                    class="h-12 rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                    Annulla
                </Button>
            </form>
        </div>
    </div>
{/if}
