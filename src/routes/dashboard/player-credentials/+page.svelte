<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, Search, Users } from 'lucide-svelte';
	import {
		DEFAULT_PLAYER_ACCOUNTS_PER_TEAM,
		MAX_PLAYER_ACCOUNTS_PER_TEAM,
		MIN_PLAYER_ACCOUNTS_PER_TEAM,
		playerSlotName
	} from '$lib/utils/player-account';

	let { data, form } = $props();
	let searchQuery = $state('');
	let showPasswords = $state(false);
	let workingTeamId = $state<string | null>(null);
	let copiedTeamId = $state<string | null>(null);
	let showRegenerationDialog = $state(false);
	let regenerationForm = $state<HTMLFormElement | null>(null);
	let regenerationMessage = $state('');
	let regenerationConfirmed = false;

	const filteredTeams = $derived(
		data.teams.filter((team) => {
			const query = searchQuery.trim().toLowerCase();
			if (!query) return true;
			return (
				team.name.toLowerCase().includes(query) ||
				team.joinCode.toLowerCase().includes(query) ||
				team.players.some(
					(player) =>
						player.name?.toLowerCase().includes(query) ||
						player.username?.toLowerCase().includes(query) ||
						player.email?.toLowerCase().includes(query)
				)
			);
		})
	);
	const playerCountOptions = Array.from(
		{ length: MAX_PLAYER_ACCOUNTS_PER_TEAM - MIN_PLAYER_ACCOUNTS_PER_TEAM + 1 },
		(_, index) => MIN_PLAYER_ACCOUNTS_PER_TEAM + index
	);

	function suggestedPlayerCount(currentPlayers: number): number {
		return Math.min(
			MAX_PLAYER_ACCOUNTS_PER_TEAM,
			Math.max(DEFAULT_PLAYER_ACCOUNTS_PER_TEAM, currentPlayers)
		);
	}

	async function copyTeamCredentials(team: (typeof data.teams)[number]) {
		const lines = [
			`Squadra: ${team.name}`,
			`Codice squadra: ${team.joinCode}`,
			...team.players.map(
				(player, index) =>
					`Giocatore ${index + 1}: ${player.name || '-'} | username: ${player.username || '-'} | password: ${player.password || 'da rigenerare'}`
			)
		];
		await navigator.clipboard.writeText(lines.join('\n'));
		copiedTeamId = team.id;
		window.setTimeout(() => (copiedTeamId = null), 2000);
	}

	function confirmRegeneration(event: SubmitEvent) {
		if (regenerationConfirmed) {
			regenerationConfirmed = false;
			return;
		}

		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const accountCount = new FormData(form).get('accountCount');
		regenerationForm = form;
		regenerationMessage = `Creare gli eventuali account mancanti e impostare una nuova password comune per i primi ${accountCount} giocatori?`;
		showRegenerationDialog = true;
	}

	function submitRegeneration() {
		const form = regenerationForm;
		regenerationForm = null;
		if (!form) return;
		regenerationConfirmed = true;
		form.requestSubmit();
	}

	function cancelRegeneration() {
		regenerationForm = null;
	}
</script>

<svelte:head>
	<title>Credenziali giocatori | PAAA Tool</title>
</svelte:head>

<div class="w-full p-6 lg:p-8">
	<div class="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<h1 class="flex items-center gap-3 text-3xl font-black text-foreground">
				<KeyRound size={30} class="text-blue-600" />
				Credenziali giocatori
			</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Squadre, account e password pronti da consegnare ai giocatori.
			</p>
		</div>
		<Button type="button" variant="outline" onclick={() => (showPasswords = !showPasswords)} class="rounded-xl">
			{#if showPasswords}<EyeOff size={16} class="mr-2" /> Nascondi password{:else}<Eye size={16} class="mr-2" /> Mostra password{/if}
		</Button>
	</div>

	{#if form?.error}
		<div class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="relative mb-6">
		<Search size={18} class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Cerca squadra, codice, nome o username..."
			class="w-full rounded-2xl border bg-background py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-ring"
		/>
	</div>

	<div class="grid gap-5 xl:grid-cols-2">
		{#each filteredTeams as team (team.id)}
			<section class="overflow-hidden rounded-2xl border bg-card shadow-sm">
				<header class="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 p-5">
					<div>
						<h2 class="text-xl font-black">{team.name}</h2>
						<p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
							Codice squadra <code class="ml-1 rounded bg-background px-2 py-1 text-primary">{team.joinCode}</code>
						</p>
					</div>
					<div class="flex gap-2">
						<Button type="button" variant="outline" size="sm" onclick={() => copyTeamCredentials(team)} class="rounded-xl">
							{#if copiedTeamId === team.id}<Check size={14} class="mr-2 text-green-600" /> Copiato{:else}<Copy size={14} class="mr-2" /> Copia{/if}
						</Button>
						<form
							action="?/provision"
							method="POST"
							onsubmit={confirmRegeneration}
							use:enhance={() => {
								workingTeamId = team.id;
								return async ({ update }) => {
									await update();
									workingTeamId = null;
								};
							}}
							class="flex items-center gap-2"
						>
							<input type="hidden" name="teamId" value={team.id} />
							<label class="flex items-center gap-2 text-xs font-bold text-muted-foreground">
								Giocatori
								<select
									name="accountCount"
									value={suggestedPlayerCount(team.players.length)}
									class="rounded-lg border bg-background px-2 py-1.5 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-ring"
								>
									{#each playerCountOptions as count}
										<option value={count}>{count}</option>
									{/each}
								</select>
							</label>
							<Button type="submit" size="sm" disabled={workingTeamId === team.id} class="rounded-xl">
								<RefreshCw size={14} class={`mr-2 ${workingTeamId === team.id ? 'animate-spin' : ''}`} />
								Crea / rigenera
							</Button>
						</form>
					</div>
				</header>

				<div class="space-y-2 p-4">
					{#if team.players.length > 0}
						{#each team.players as player, index (player.id)}
							<div class="grid gap-2 rounded-xl border bg-background p-3 sm:grid-cols-[1fr_1fr_1fr] sm:items-center">
								<div class="min-w-0">
									<p class="truncate text-sm font-bold">{player.name || playerSlotName(team.joinCode, index + 1)}</p>
									<p class="truncate text-[11px] text-muted-foreground">{player.email || 'Email non inserita'}</p>
								</div>
								<code class="truncate rounded-lg bg-muted px-3 py-2 text-xs font-bold">{player.username || 'username da creare'}</code>
								<div class="rounded-lg bg-zinc-950 px-3 py-2 text-xs text-white">
									{#if player.password}
										<code class="font-bold tracking-wider">{showPasswords ? player.password : '••••••••••'}</code>
									{:else}
										<span class="text-amber-300">{player.hasPassword ? 'Rigenera per visualizzare' : 'Password da creare'}</span>
									{/if}
								</div>
							</div>
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground">
							<Users size={30} class="mx-auto mb-2 opacity-40" />
							Nessun giocatore: usa “Crea account”.
						</div>
					{/if}
				</div>
			</section>
		{/each}
	</div>

	{#if filteredTeams.length === 0}
		<div class="rounded-2xl border border-dashed p-14 text-center text-muted-foreground">Nessuna squadra trovata.</div>
	{/if}
</div>

<ConfirmDialog
	bind:show={showRegenerationDialog}
	title="Rigenera credenziali"
	message={regenerationMessage}
	confirmLabel="Crea / rigenera"
	type="warning"
	onConfirm={submitRegeneration}
	onCancel={cancelRegeneration}
/>
