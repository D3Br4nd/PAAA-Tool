<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { getAvatarUrl } from "$lib/utils/avatar";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import { ArrowDown, ArrowUp, Flag, Swords, Trophy } from "lucide-svelte";

  let { data }: { data: any } = $props();
  const event = $derived(data.event);
  const leaderboard = $derived(data.leaderboard || []);
  const stats = $derived(data.stats || {});

  let previousRanks: Record<string, number> = $state({});
  let previousScores: Record<string, number> = $state({});

  $effect(() => {
    const currentList = leaderboard;
    if (currentList.length > 0) {
      const timer = setTimeout(() => {
        const rankMap: Record<string, number> = {};
        const scoreMap: Record<string, number> = {};
        currentList.forEach((row: any) => {
          rankMap[row.id] = row.rank;
          scoreMap[row.id] = row.score;
        });
        previousRanks = rankMap;
        previousScores = scoreMap;
      }, 8500);
      return () => clearTimeout(timer);
    }
  });

  onMount(() => {
    const rankMap: Record<string, number> = {};
    const scoreMap: Record<string, number> = {};
    leaderboard.forEach((row: any) => {
      rankMap[row.id] = row.rank;
      scoreMap[row.id] = row.score;
    });
    previousRanks = rankMap;
    previousScores = scoreMap;

    const interval = setInterval(() => {
      invalidateAll();
    }, 10000);

    return () => clearInterval(interval);
  });

  function movedUp(row: any) {
    return previousRanks[row.id] && previousRanks[row.id] > row.rank;
  }

  function movedDown(row: any) {
    return previousRanks[row.id] && previousRanks[row.id] < row.rank;
  }

  function changedScore(row: any) {
    return (
      previousScores[row.id] !== undefined &&
      previousScores[row.id] !== row.score
    );
  }
</script>

<svelte:head>
  <title>Fase 3 - {event.name}</title>
  <meta
    name="description"
    content="Classifica live della fase 3 di {event.name}"
  />
</svelte:head>

<main
  class="phase-three-board relative min-h-screen overflow-hidden bg-zinc-950 text-white"
>
  <div class="animated-field absolute inset-0"></div>
  <div
    class="absolute inset-0 bg-linear-to-b from-zinc-950/85 via-zinc-950/45 to-zinc-950"
  ></div>

  <header
    class="relative z-10 flex items-center justify-between gap-4 px-5 py-5 md:px-10"
  >
    <a
      href="/{event.slug}"
      class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-md transition-colors hover:bg-white/10"
    >
      <img
        src="/mini-icon-plv-white.png"
        alt="Pro Loco Venticano"
        class="h-10 w-auto"
      />
      <span
        class="hidden text-[11px] font-black uppercase tracking-widest text-white/70 sm:block"
      >
        Classifica generale
      </span>
    </a>

    <div
      class="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-200"
    >
      <span class="relative flex h-2 w-2">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"
        ></span>
        <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-300"
        ></span>
      </span>
      Live
    </div>
  </header>

  <section
    class="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl flex-col px-4 pb-10 md:px-8"
  >
    <div class="mx-auto mb-8 max-w-4xl text-center">
      {#if event.logoUrl}
        <img
          src={event.logoUrl}
          alt="Logo {event.name}"
          class="mx-auto mb-5 h-20 w-20 object-contain drop-shadow-[0_0_24px_rgba(34,211,238,0.35)] md:h-28 md:w-28"
        />
      {/if}

      <div
        class="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-cyan-200"
      >
        <Swords size={16} />
        Fase 3
      </div>
      <h1
        class="text-4xl font-black uppercase leading-tight text-white md:text-7xl"
      >
		La Notte del Giudizio
      </h1>
      <p
        class="mt-4 text-sm font-bold uppercase tracking-widest text-white/55 md:text-base"
      >
        {event.name}
      </p>
    </div>

    <div class="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div
        class="rounded-xl border border-white/10 bg-white/[0.07] p-5 text-center backdrop-blur-md"
      >
        <div class="text-4xl font-black tabular-nums text-white">
          {stats.totalTeams || 0}
        </div>
        <div
          class="mt-1 text-[10px] font-black uppercase tracking-widest text-white/45"
        >
          Squadre in gara
        </div>
      </div>
      <div
        class="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-5 text-center backdrop-blur-md"
      >
        <div class="text-4xl font-black tabular-nums text-cyan-200">
          {stats.topScore || 0}
        </div>
        <div
          class="mt-1 text-[10px] font-black uppercase tracking-widest text-cyan-100/60"
        >
          Punteggio più alto
        </div>
      </div>
      <div
        class="rounded-xl border border-rose-300/25 bg-rose-300/10 p-5 text-center backdrop-blur-md"
      >
        <div class="text-4xl font-black tabular-nums text-rose-200">
          {stats.leaders || 0}
        </div>
        <div
          class="mt-1 text-[10px] font-black uppercase tracking-widest text-rose-100/60"
        >
          Squadre al comando
        </div>
      </div>
    </div>

    {#if leaderboard.length > 0}
      <div class="space-y-4">
        {#each leaderboard as row (row.id)}
          <article
            animate:flip={{ duration: 850, easing: cubicOut }}
            class="team-row relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.08] p-4 shadow-2xl backdrop-blur-xl transition-all duration-500 md:p-5 {changedScore(
              row,
            )
              ? 'is-changing'
              : ''} {row.isLeader ? 'is-leader' : ''}"
            style="--faction-color: {row.factionColor ||
              '#22d3ee'}; --score-level: {row.scoreLevel}%"
          >
            <div
              class="absolute inset-y-0 left-0 w-1.5 bg-[var(--faction-color)]"
            ></div>
            <div
              class="score-glow absolute inset-y-0 left-0 bg-linear-to-r from-cyan-300/20 via-fuchsia-300/10 to-transparent"
            ></div>

            <div
              class="relative z-10 grid grid-cols-1 gap-4 lg:grid-cols-[90px_1fr_320px_150px] lg:items-center"
            >
              <div class="flex items-center gap-3 lg:justify-center">
                <div
                  class="rank-badge flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-zinc-950/70 text-2xl font-black tabular-nums text-white shadow-lg"
                >
                  #{row.rank}
                </div>
                <div class="lg:hidden">
                  {#if movedUp(row)}
                    <ArrowUp
                      size={22}
                      class="animate-bounce text-emerald-300"
                    />
                  {:else if movedDown(row)}
                    <ArrowDown size={22} class="text-red-300" />
                  {/if}
                </div>
              </div>

              <div class="flex min-w-0 items-center gap-4">
                <div
                  class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-zinc-900"
                >
                  <img
                    src={getAvatarUrl(
                      row.teamAvatarUrl,
                      row.teamName || "Team",
                      "team",
                    )}
                    alt=""
                    class="h-full w-full object-cover"
                  />
                </div>
                <div class="min-w-0">
                  <h2
                    class="truncate text-2xl font-black uppercase leading-tight text-white md:text-4xl"
                  >
                    {row.teamName}
                  </h2>
                  <div
                    class="mt-2 inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest"
                    style="border-color: {row.factionColor ||
                      '#22d3ee'}55; color: {row.factionColor ||
                      '#22d3ee'}; background-color: {row.factionColor ||
                      '#22d3ee'}18"
                  >
                    <Flag size={13} />
                    {row.factionName}
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <div
                  class="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/45"
                >
                  <span>Punteggio fase</span>
                  <span>{row.score} pt</span>
                </div>
                <div
                  class="h-5 overflow-hidden rounded-full border border-white/10 bg-zinc-950/70"
                >
                  <div class="score-bar h-full rounded-full"></div>
                </div>
              </div>

              <div
                class="flex items-center justify-between gap-3 lg:justify-end"
              >
                <div class="hidden w-6 lg:block">
                  {#if movedUp(row)}
                    <ArrowUp
                      size={24}
                      class="animate-bounce text-emerald-300"
                    />
                  {:else if movedDown(row)}
                    <ArrowDown size={24} class="text-red-300" />
                  {/if}
                </div>
                <div class="text-right">
                  <div
                    class="text-4xl font-black tabular-nums text-cyan-200 md:text-5xl"
                  >
                    {row.score}
                  </div>
                  <div
                    class="mt-1 text-[10px] font-black uppercase tracking-widest text-white/40"
                  >
                    Punti
                  </div>
                  {#if row.isLeader}
                    <div
                      class="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-300 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-950"
                    >
                      <Trophy size={13} />
                      In testa
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <div
        class="mx-auto mt-8 max-w-xl rounded-xl border border-white/10 bg-white/[0.08] p-10 text-center backdrop-blur-xl"
      >
        <Swords size={42} class="mx-auto mb-4 text-cyan-200" />
        <h2 class="text-2xl font-black uppercase text-white">
          Nessuna squadra in Fase 3
        </h2>
        <p class="mt-3 text-sm font-bold text-white/50">
          Il tabellone si aggiornerà appena lo staff inserirà il primo
          punteggio.
        </p>
      </div>
    {/if}
  </section>
</main>

<style>
  .animated-field {
    background:
      linear-gradient(115deg, rgba(34, 211, 238, 0.14), transparent 30%),
      linear-gradient(245deg, rgba(244, 63, 94, 0.12), transparent 32%),
      linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
      #09090b;
    background-size:
      100% 100%,
      100% 100%,
      48px 48px,
      48px 48px,
      100% 100%;
    animation: field-drift 18s linear infinite;
  }

  .team-row {
    box-shadow: 0 22px 60px rgba(0, 0, 0, 0.32);
  }

  .team-row.is-changing {
    animation: row-flash 1.4s ease-out;
  }

  .team-row.is-leader {
    border-color: rgba(251, 113, 133, 0.5);
    background: rgba(136, 19, 55, 0.24);
  }

  .score-glow,
  .score-bar {
    width: var(--score-level);
    transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .score-bar {
    background: linear-gradient(90deg, #22d3ee, #a78bfa, #fb7185);
    background-size: 220% 100%;
    box-shadow: 0 0 28px rgba(34, 211, 238, 0.35);
    animation: score-flow 2.8s linear infinite;
  }

  @keyframes field-drift {
    from {
      background-position:
        0 0,
        0 0,
        0 0,
        0 0,
        0 0;
    }
    to {
      background-position:
        0 0,
        0 0,
        48px 48px,
        48px 48px,
        0 0;
    }
  }

  @keyframes score-flow {
    from {
      background-position: 0 0;
    }
    to {
      background-position: 220% 0;
    }
  }

  @keyframes row-flash {
    0% {
      transform: scale(1);
      border-color: rgba(34, 211, 238, 0.25);
    }
    35% {
      transform: scale(1.015);
      border-color: rgba(34, 211, 238, 0.95);
      box-shadow: 0 0 44px rgba(34, 211, 238, 0.28);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
