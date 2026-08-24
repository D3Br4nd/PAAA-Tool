<script lang="ts">
    import { enhance } from "$app/forms";
    import { page } from "$app/stores";
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Shield, Users, ArrowRight, Loader2 } from "lucide-svelte";

    let { form } = $props();

    let activeTab = $state<"player" | "admin">("player");
    let playerLoginMode = $state<"code" | "password">("password");
    let loading = $state(false);

    const roleParam = $derived($page.url.searchParams.get("role"));
    const isRoleLocked = $derived(roleParam === "player" || roleParam === "admin");

    $effect(() => {
        if (roleParam === "admin") activeTab = "admin";
        if (roleParam === "player") activeTab = "player";
    });
</script>

<svelte:head>
    <title>Login | PAAA Tool</title>
</svelte:head>

<div
    class="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 transition-colors duration-500 overflow-hidden font-sans"
    style="background-image: radial-gradient(circle at top right, #1e1b4b, transparent), radial-gradient(circle at bottom left, #0f172a, transparent);"
>
    <!-- Logos Header -->
    <div
        class="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start pointer-events-none"
    >
        <a href="/" class="pointer-events-auto">
            <img
                src="/mini-icon-plv-white.png"
                alt="Pro Loco Venticano Logo"
                class="h-12 w-auto sm:h-16 drop-shadow-lg opacity-90 hover:opacity-100 transition-opacity"
            />
        </a>
        <a href="/" class="pointer-events-auto">
            <img
                src="/paaa-logo.png"
                alt="Comitato PAAA Logo"
                class="h-12 w-auto sm:h-16 drop-shadow-lg opacity-90 hover:opacity-100 transition-opacity"
            />
        </a>
    </div>

    <div class="w-full max-w-md space-y-8 z-10 my-auto">
        <div
            class="text-center animate-in fade-in slide-in-from-bottom-4 duration-700"
        >
            <h1
                class="text-4xl font-extrabold tracking-tight text-white mb-2 drop-shadow-2xl"
            >
                PAAA-Tool
            </h1>
            <p class="text-slate-400">Treasure Hunt Evolution</p>
        </div>

        <Card.Card
            class="border-white/10 bg-slate-900/50 backdrop-blur-xl animate-in zoom-in-95 duration-500 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        >
            <Card.CardHeader>
                {#if !isRoleLocked}
                    <div
                        class="flex p-1 bg-slate-950/80 rounded-lg mb-6 border border-white/5"
                    >
                        <button
                            class="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200 {activeTab ===
                            'player'
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-300'}"
                            onclick={() => (activeTab = "player")}
                        >
                            <Users size={16} />
                            Squadra
                        </button>
                        <button
                            class="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200 {activeTab ===
                            'admin'
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-300'}"
                            onclick={() => (activeTab = "admin")}
                        >
                            <Shield size={16} />
                            Staff / Admin
                        </button>
                    </div>
                {/if}
                <Card.CardTitle class="text-2xl text-white">
                    {activeTab === "player"
                        ? "Accesso Squadra"
                        : "Accesso Staff / Admin"}
                </Card.CardTitle>
                <Card.CardDescription class="text-slate-400">
                    {activeTab === "player"
                        ? "Accedi con username o email e password, oppure usa il codice squadra."
                        : "Accesso unico con email e password."}
                </Card.CardDescription>
            </Card.CardHeader>

            <Card.CardContent>
                {#if form?.message}
                    <div
                        class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-500 text-sm animate-in shake-1"
                    >
                        {form.message}
                    </div>
                {/if}

                {#if activeTab === "player"}
                    <div
                        class="flex p-1 bg-slate-950/80 rounded-lg mb-6 border border-white/5 w-fit mx-auto"
                    >
                        <button
                            type="button"
                            class="px-4 py-1.5 text-xs font-medium rounded-md transition-all {playerLoginMode ===
                            'password'
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-500'}"
                            onclick={() => (playerLoginMode = "password")}
                        >
                            Account Giocatore
                        </button>
                        <button
                            type="button"
                            class="px-4 py-1.5 text-xs font-medium rounded-md transition-all {playerLoginMode ===
                            'code'
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-500'}"
                            onclick={() => (playerLoginMode = "code")}
                        >
                            Codice Squadra
                        </button>
                    </div>

                    <form
                        method="POST"
                        action="?/player"
                        use:enhance={() => {
                            loading = true;
                            return async ({ update }) => {
                                loading = false;
                                await update();
                            };
                        }}
                        class="space-y-4"
                    >
                        {#if playerLoginMode === "password"}
                            <div
                                class="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300"
                            >
                                <div class="space-y-2">
                                    <label
                                        for="player-identity"
                                        class="text-sm font-medium text-slate-300"
                                        >Username o email</label
                                    >
                                    <input
                                        id="player-identity"
                                        name="identity"
                                        type="text"
                                        placeholder="es: rdx4k7m2-1"
                                        required
                                        autocomplete="username"
                                        autocapitalize="none"
                                        spellcheck="false"
                                        class="w-full bg-slate-950/50 border-white/10 text-white rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all placeholder:text-slate-700"
                                    />
                                </div>
                                <div class="space-y-2">
                                    <label
                                        for="player-password"
                                        class="text-sm font-medium text-slate-300"
                                        >Password</label
                                    >
                                    <input
                                        id="player-password"
                                        name="password"
                                        type="password"
                                        required
                                        class="w-full bg-slate-950/50 border-white/10 text-white rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>
                        {:else}
                            <div
                                class="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300"
                            >
                                <label
                                    for="joinCode"
                                    class="text-sm font-medium text-slate-300"
                                    >Codice Squadra</label
                                >
                                <input
                                    id="joinCode"
                                    name="joinCode"
                                    type="text"
                                    placeholder="Es: RDX4K7M2"
                                    required
                                    autocomplete="one-time-code"
                                    autocapitalize="characters"
                                    spellcheck="false"
                                    oninput={(event) => {
                                        const input = event.currentTarget;
                                        input.value = input.value.replace(/\s+/g, "").toUpperCase();
                                    }}
                                    class="w-full bg-slate-950/50 border-white/10 text-white rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all placeholder:text-slate-700 uppercase tracking-widest font-mono"
                                />
                            </div>
                        {/if}

                        <Button
                            type="submit"
                            class="w-full bg-linear-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-semibold py-6 transition-all shadow-lg shadow-fuchsia-900/20"
                            disabled={loading}
                        >
                            {#if loading}
                                <Loader2 class="animate-spin mr-2" />
                            {/if}
                            Entra nel Gioco
                            <ArrowRight size={18} class="ml-2" />
                        </Button>
                    </form>
                {:else}
                    <form
                        method="POST"
                        action="?/admin"
                        use:enhance={() => {
                            loading = true;
                            return async ({ update }) => {
                                loading = false;
                                await update();
                            };
                        }}
                        class="space-y-4"
                    >
                        <div class="space-y-2">
                            <label
                                for="email"
                                class="text-sm font-medium text-slate-300"
                                >Email</label
                            >
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="admin@example.com"
                                required
                                class="w-full bg-slate-950/50 border-white/10 text-white rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all placeholder:text-slate-700"
                            />
                        </div>
                        <div class="space-y-2">
                            <label
                                for="password"
                                class="text-sm font-medium text-slate-300"
                                >Password</label
                            >
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                class="w-full bg-slate-950/50 border-white/10 text-white rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <Button
                            type="submit"
                            class="w-full bg-white hover:bg-slate-200 text-slate-950 font-semibold py-6 transition-all"
                            disabled={loading}
                        >
                            {#if loading}
                                <Loader2 class="animate-spin mr-2" />
                            {/if}
                            Accedi
                        </Button>
                    </form>
                {/if}
            </Card.CardContent>
        </Card.Card>
    </div>

    <!-- Footer -->
    <footer
        class="w-full border-t border-white/10 pt-6 pb-2 mt-auto z-10 text-center"
    >
        <div class="text-sm text-slate-300 mb-2">
            <span class="font-semibold text-slate-100">Pro Loco Venticano</span>
            <span class="text-slate-500"> — </span>
            <span>Comitato Per Aspera ad Astra</span>
        </div>
        <div class="flex justify-center gap-4 text-xs text-slate-500 mb-2">
            <a
                href="https://www.prolocoventicano.com/privacy-policy/"
                target="_blank"
                class="hover:text-white transition-colors">Privacy</a
            >
            <a
                href="https://www.prolocoventicano.com/cookie-policy/"
                target="_blank"
                class="hover:text-white transition-colors">Cookie</a
            >
        </div>
        <div class="text-[10px] text-slate-600">
            &copy; {new Date().getFullYear()} PAAA Tool.
        </div>
    </footer>
</div>

<style>
    :global(body) {
        background-color: #09090b;
    }

    @keyframes shake {
        0%,
        100% {
            transform: translateX(0);
        }
        25% {
            transform: translateX(-4px);
        }
        75% {
            transform: translateX(4px);
        }
    }
    .shake-1 {
        animation: shake 0.2s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }
</style>
