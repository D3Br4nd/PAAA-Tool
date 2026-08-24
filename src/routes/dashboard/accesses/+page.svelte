<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import { Button } from "$lib/components/ui/button";
  import {
    Ban,
    CheckCircle2,
    CircleX,
    KeyRound,
    LogIn,
    MonitorSmartphone,
    Network,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    TriangleAlert,
  } from "lucide-svelte";

  let { data, form } = $props();
  let showClearLogsDialog = $state(false);
  let clearLogsForm = $state<HTMLFormElement | null>(null);
  let isClearingLogs = $state(false);

  const periods = [
    { value: 1, label: "24 ore" },
    { value: 7, label: "7 giorni" },
    { value: 30, label: "30 giorni" },
  ];
  const outcomes = [
    { value: "all", label: "Tutti" },
    { value: "success", label: "Riusciti" },
    { value: "denied", label: "Negati" },
  ];

  const reasonLabels: Record<string, string> = {
    invalid_credentials: "Credenziali non valide",
    unauthorized_role: "Ruolo non autorizzato per quest'area",
    password_not_configured: "Password non configurata",
    invalid_join_code: "Codice squadra non valido",
    rate_limited: "Limite di tentativi superato",
    account_locked: "Account temporaneamente bloccato",
    missing_fields: "Dati di accesso incompleti",
  };

  function filterHref(days: number, outcome: string) {
    return `/dashboard/accesses?days=${days}&outcome=${outcome}`;
  }

  function formatDate(value: Date | string | number) {
    return new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(value));
  }

  function deviceLabel(userAgent: string | null) {
    if (!userAgent) return "Dispositivo sconosciuto";
    const browser = userAgent.includes("Edg/")
      ? "Edge"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Chrome/")
          ? "Chrome"
          : userAgent.includes("Safari/")
            ? "Safari"
            : "Browser";
    const system = /Android/i.test(userAgent)
      ? "Android"
      : /iPhone|iPad/i.test(userAgent)
        ? "iOS"
        : /Windows/i.test(userAgent)
          ? "Windows"
          : /Mac OS/i.test(userAgent)
            ? "macOS"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : "sistema sconosciuto";
    return `${browser} · ${system}`;
  }

  function accessLabel(area: string, method: string) {
    const target = area === "admin" ? "Staff / Admin" : "Giocatore";
    const auth =
      method === "join_code"
        ? "codice squadra"
        : method === "password"
          ? "password"
          : "metodo non rilevato";
    return `${target} · ${auth}`;
  }
</script>

<svelte:head>
  <title>Controllo accessi | PAAA Tool</title>
</svelte:head>

<div class="w-full p-6 lg:p-8">
  <header
    class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
  >
    <div>
      <div class="mb-2 flex items-center gap-2 text-sm font-bold text-blue-600">
        <ShieldCheck size={18} />
        Sicurezza
      </div>
      <h1 class="text-3xl font-bold tracking-tight">Controllo accessi</h1>
      <p class="mt-1 max-w-3xl text-sm text-zinc-500">
        Login riusciti, tentativi negati e blocchi automatici. Il monitoraggio
        parte dall'installazione di questa funzione: gli accessi precedenti non
        sono ricostruibili.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <a
        href={filterHref(data.filters.days, data.filters.outcome)}
        class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
      >
        <RefreshCw size={16} /> Aggiorna
      </a>
      <Button
        type="button"
        variant="outline"
        onclick={() => (showClearLogsDialog = true)}
        disabled={isClearingLogs}
        class="h-10 rounded-lg border-red-200 px-4 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        <Trash2 size={16} class="mr-2" />
        {isClearingLogs ? "Azzeramento..." : "Azzera log accessi"}
      </Button>
    </div>
  </header>

  {#if form?.logsCleared}
    <section
      class="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
    >
      <CheckCircle2 size={22} class="mt-0.5 shrink-0 text-emerald-600" />
      <div>
        <h2 class="font-bold">Registro accessi azzerato</h2>
        <p class="mt-0.5 text-sm text-emerald-800">
          Eliminati {form.clearedCount} eventi dal registro.
        </p>
      </div>
    </section>
  {/if}

  {#if data.stats.suspiciousIps > 0 || data.stats.blocked > 0}
    <section
      class="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950"
    >
      <ShieldAlert size={22} class="mt-0.5 shrink-0 text-red-600" />
      <div>
        <h2 class="font-bold">Attività da verificare</h2>
        <p class="mt-0.5 text-sm text-red-800">
          {data.stats.suspiciousIps} IP con almeno 3 tentativi negati e
          {data.stats.blocked} tentativi bloccati nel periodo. Controlla sorgenti,
          account e dispositivi qui sotto.
        </p>
      </div>
    </section>
  {:else if data.stats.failed > 0}
    <section
      class="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
    >
      <TriangleAlert size={22} class="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <h2 class="font-bold">Tentativi negati rilevati</h2>
        <p class="mt-0.5 text-sm text-amber-800">
          Sono presenti {data.stats.failed} errori di autenticazione. Un errore isolato
          può essere un semplice refuso; le ripetizioni dallo stesso IP meritano attenzione.
        </p>
      </div>
    </section>
  {:else}
    <section
      class="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
    >
      <CheckCircle2 size={22} class="mt-0.5 shrink-0 text-emerald-600" />
      <div>
        <h2 class="font-bold">Nessun tentativo negato rilevato</h2>
        <p class="mt-0.5 text-sm text-emerald-800">
          Nel periodo selezionato non risultano errori o blocchi di
          autenticazione.
        </p>
      </div>
    </section>
  {/if}

  <div class="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-5">
    <div class="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div
        class="flex items-center justify-between text-sm font-semibold text-zinc-500"
      >
        Totali <LogIn size={17} />
      </div>
      <p class="mt-2 text-3xl font-bold">{data.stats.total}</p>
    </div>
    <div
      class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm"
    >
      <div
        class="flex items-center justify-between text-sm font-semibold text-emerald-700"
      >
        Riusciti <CheckCircle2 size={17} />
      </div>
      <p class="mt-2 text-3xl font-bold text-emerald-700">
        {data.stats.successful}
      </p>
    </div>
    <div
      class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm"
    >
      <div
        class="flex items-center justify-between text-sm font-semibold text-amber-700"
      >
        Negati <CircleX size={17} />
      </div>
      <p class="mt-2 text-3xl font-bold text-amber-700">{data.stats.failed}</p>
    </div>
    <div class="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
      <div
        class="flex items-center justify-between text-sm font-semibold text-red-700"
      >
        Bloccati <Ban size={17} />
      </div>
      <p class="mt-2 text-3xl font-bold text-red-700">{data.stats.blocked}</p>
    </div>
    <div
      class="col-span-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-1"
    >
      <div
        class="flex items-center justify-between text-sm font-semibold text-zinc-500"
      >
        IP distinti <Network size={17} />
      </div>
      <p class="mt-2 text-3xl font-bold">{data.stats.uniqueIps}</p>
    </div>
  </div>

  <div
    class="mb-6 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex flex-wrap gap-1" aria-label="Periodo">
      {#each periods as period}
        <a
          href={filterHref(period.value, data.filters.outcome)}
          class="rounded-lg px-3 py-2 text-sm font-semibold transition {data
            .filters.days === period.value
            ? 'bg-zinc-900 text-white shadow-sm'
            : 'text-zinc-600 hover:bg-white'}">{period.label}</a
        >
      {/each}
    </div>
    <div class="flex flex-wrap gap-1" aria-label="Esito">
      {#each outcomes as outcome}
        <a
          href={filterHref(data.filters.days, outcome.value)}
          class="rounded-lg px-3 py-2 text-sm font-semibold transition {data
            .filters.outcome === outcome.value
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-zinc-600 hover:bg-white'}">{outcome.label}</a
        >
      {/each}
    </div>
  </div>

  {#if data.suspiciousSources.length > 0}
    <section class="mb-7">
      <div class="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">Sorgenti da verificare</h2>
          <p class="text-sm text-zinc-500">
            IP con almeno tre tentativi negati nel periodo.
          </p>
        </div>
        {#if data.stats.suspiciousIps > data.suspiciousSources.length}
          <span class="text-xs font-semibold text-zinc-500"
            >Prime 10 di {data.stats.suspiciousIps}</span
          >
        {/if}
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each data.suspiciousSources as source}
          <div
            class="flex items-center gap-3 rounded-xl border border-red-200 bg-white p-4 shadow-sm"
          >
            <div class="rounded-lg bg-red-100 p-2 text-red-700">
              <Network size={19} />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-mono text-sm font-bold">
                {source.ipAddress}
              </p>
              <p class="text-xs text-zinc-500">
                Ultimo: {formatDate(source.lastAttemptAt)}
              </p>
            </div>
            <span
              class="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700"
            >
              {source.denied} negati
            </span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section
    class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4"
    >
      <div>
        <h2 class="font-bold">Registro recente</h2>
        <p class="text-xs text-zinc-500">
          Mostrati {data.entries.length} di {data.filteredTotal} eventi filtrati (massimo
          200).
        </p>
      </div>
      <KeyRound size={19} class="text-zinc-400" />
    </div>

    {#if data.entries.length === 0}
      <div class="px-6 py-14 text-center">
        <ShieldCheck size={34} class="mx-auto mb-3 text-zinc-300" />
        <p class="font-semibold text-zinc-700">
          Nessun accesso nel filtro selezionato
        </p>
        <p class="mt-1 text-sm text-zinc-500">
          I nuovi tentativi appariranno qui al prossimo aggiornamento.
        </p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-left text-sm">
          <thead
            class="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"
          >
            <tr>
              <th class="px-5 py-3 font-bold">Esito</th>
              <th class="px-5 py-3 font-bold">Data e ora</th>
              <th class="px-5 py-3 font-bold">Account / area</th>
              <th class="px-5 py-3 font-bold">IP</th>
              <th class="px-5 py-3 font-bold">Dispositivo</th>
              <th class="px-5 py-3 font-bold">Dettaglio</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100">
            {#each data.entries as entry}
              <tr class="align-top transition hover:bg-zinc-50/70">
                <td class="px-5 py-4">
                  {#if entry.outcome === "success"}
                    <span
                      class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700"
                    >
                      <CheckCircle2 size={13} /> Riuscito
                    </span>
                  {:else if entry.outcome === "blocked"}
                    <span
                      class="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700"
                    >
                      <Ban size={13} /> Bloccato
                    </span>
                  {:else}
                    <span
                      class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700"
                    >
                      <CircleX size={13} /> Negato
                    </span>
                  {/if}
                </td>
                <td
                  class="whitespace-nowrap px-5 py-4 font-medium text-zinc-700"
                >
                  {formatDate(entry.createdAt)}
                </td>
                <td class="px-5 py-4">
                  <p
                    class="max-w-52 truncate font-semibold text-zinc-900"
                    title={entry.subject || undefined}
                  >
                    {entry.subject || "Non identificato"}
                  </p>
                  <p class="mt-0.5 text-xs text-zinc-500">
                    {accessLabel(entry.area, entry.method)}
                  </p>
                </td>
                <td
                  class="px-5 py-4 font-mono text-xs font-semibold text-zinc-700"
                >
                  {entry.ipAddress}
                </td>
                <td class="px-5 py-4">
                  <div
                    class="flex items-center gap-2"
                    title={entry.userAgent || undefined}
                  >
                    <MonitorSmartphone
                      size={16}
                      class="shrink-0 text-zinc-400"
                    />
                    <span>{deviceLabel(entry.userAgent)}</span>
                  </div>
                </td>
                <td class="px-5 py-4 text-zinc-600">
                  {entry.reason
                    ? reasonLabels[entry.reason] || entry.reason
                    : "Credenziali accettate"}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <p class="mt-4 text-xs leading-relaxed text-zinc-500">
    Nota: un login riuscito conferma che sono state usate credenziali valide, ma
    non può provare l'identità fisica della persona. Verifica IP o dispositivi
    insoliti con il titolare dell'account. Password e codici squadra non vengono
    salvati nel registro.
  </p>
</div>

<ConfirmDialog
  bind:show={showClearLogsDialog}
  title="Azzera log accessi"
  message="Eliminare definitivamente tutto lo storico degli accessi? L'operazione non può essere annullata e non modifica utenti, credenziali o sessioni."
  confirmLabel="Azzera log"
  type="danger"
  onConfirm={() => clearLogsForm?.requestSubmit()}
/>

<form
  bind:this={clearLogsForm}
  method="POST"
  action="?/clearLogs"
  use:enhance={() => {
    isClearingLogs = true;
    return async ({ update }) => {
      await update();
      isClearingLogs = false;
    };
  }}
  class="hidden"
></form>
