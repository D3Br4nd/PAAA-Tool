<script lang="ts">
	import { enhance } from "$app/forms";
	import { Button } from "$lib/components/ui/button";
	import {
		Users,
		Plus,
		Pencil,
		Trash2,
		X,
		Upload,
		RefreshCw,
		Search,
		Filter,
	} from "lucide-svelte";
	import { getAvatarUrl } from "$lib/utils/avatar";
	import {
		parsePlanetAvatarSeed,
		planetAvatarUrl,
	} from "$lib/utils/planet-avatar";

	let { data, form } = $props();

	// Dialog state
	let showDialog = $state(false);
	let editingUser = $state<(typeof data.users)[0] | null>(null);
	let isSubmitting = $state(false);
	let selectedRole = $state<"admin" | "staff" | "player">("player");

	// Avatar preview
	let avatarPreview = $state<string | null>(null);
	let avatarInput = $state<HTMLInputElement | null>(null);
	let avatarSeed = $state("");
	let avatarVariantBase = $state("avatar");
	const avatarVariants = $derived(() =>
		Array.from({ length: 6 }, (_, index) =>
			index === 0
				? avatarVariantBase
				: `${avatarVariantBase}-${index + 1}`,
		),
	);

	// Deletion state
	let showDeleteDialog = $state(false);
	let userToDelete = $state<(typeof data.users)[0] | null>(null);
	let selectedUserIds = $state<string[]>([]);

	// Filters
	let searchQuery = $state("");
	let roleFilter = $state<"all" | "admin" | "staff" | "player">("all");

	// Filtered users
	const filteredUsers = $derived(() => {
		let result = data.users;

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(u) =>
					u.name?.toLowerCase().includes(query) ||
					u.username?.toLowerCase().includes(query) ||
					u.email?.toLowerCase().includes(query),
			);
		}

		// Role filter
		if (roleFilter !== "all") {
			result = result.filter((u) => u.role === roleFilter);
		}

		return result;
	});
	const selectableFilteredUsers = $derived(() =>
		filteredUsers().filter((user) => user.id !== data.currentUser?.id),
	);
	const allFilteredUsersSelected = $derived(() => {
		const selectableUsers = selectableFilteredUsers();
		return (
			selectableUsers.length > 0 &&
			selectableUsers.every((user) => selectedUserIds.includes(user.id))
		);
	});
	const someFilteredUsersSelected = $derived(() => {
		const selectedVisibleUsers = selectableFilteredUsers().filter((user) =>
			selectedUserIds.includes(user.id),
		).length;
		return (
			selectedVisibleUsers > 0 &&
			selectedVisibleUsers < selectableFilteredUsers().length
		);
	});

	function indeterminate(node: HTMLInputElement, value: boolean) {
		node.indeterminate = value;

		return {
			update(nextValue: boolean) {
				node.indeterminate = nextValue;
			},
		};
	}

	function toggleUserSelection(userId: string, checked: boolean) {
		selectedUserIds = checked
			? Array.from(new Set([...selectedUserIds, userId]))
			: selectedUserIds.filter((id) => id !== userId);
	}

	function toggleAllFilteredUsers(checked: boolean) {
		const visibleIds = selectableFilteredUsers().map((user) => user.id);
		selectedUserIds = checked
			? Array.from(new Set([...selectedUserIds, ...visibleIds]))
			: selectedUserIds.filter((id) => !visibleIds.includes(id));
	}

	function createAvatarSeed(): string {
		if (typeof globalThis.crypto?.randomUUID === "function") {
			return globalThis.crypto.randomUUID();
		}

		return `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function selectPlanetAvatar(seed: string) {
		avatarSeed = seed;
		avatarPreview = planetAvatarUrl(seed);
		if (avatarInput) avatarInput.value = "";
	}

	function regenerateAvatarVariants() {
		avatarVariantBase = createAvatarSeed();
		selectPlanetAvatar(avatarVariantBase);
	}

	function openCreateDialog() {
		editingUser = null;
		avatarVariantBase = createAvatarSeed();
		avatarSeed = avatarVariantBase;
		avatarPreview = planetAvatarUrl(avatarSeed);
		selectedRole = "player";
		showDialog = true;
	}

	function openEditDialog(user: (typeof data.users)[0]) {
		const savedPlanetSeed = parsePlanetAvatarSeed(user.avatarUrl);
		const usesPlanetFallback =
			!user.avatarUrl || user.avatarUrl.includes("api.dicebear.com");
		avatarVariantBase = savedPlanetSeed || user.id;
		avatarSeed =
			savedPlanetSeed || (usesPlanetFallback ? avatarVariantBase : "");
		editingUser = user;
		avatarPreview = getAvatarUrl(user.avatarUrl, user.id, "user");
		selectedRole = user.role;
		showDialog = true;
	}

	function closeDialog() {
		showDialog = false;
		editingUser = null;
		avatarPreview = null;
		avatarSeed = "";
	}

	function triggerDelete(user: (typeof data.users)[0]) {
		userToDelete = user;
		showDeleteDialog = true;
	}

	function triggerBulkDelete() {
		if (selectedUserIds.length === 0) return;
		userToDelete = null;
		showDeleteDialog = true;
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		userToDelete = null;
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

	function getRoleBadgeColor(role: string) {
		switch (role) {
			case "admin":
				return "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30";
			case "staff":
				return "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30";
			default:
				return "bg-zinc-100 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-500/30";
		}
	}
</script>

<div class="p-6 lg:p-8 w-full">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-3">
				<Users size={28} class="text-blue-600" />
				Gestione Utenti
			</h1>
			<p class="text-zinc-500 dark:text-zinc-400 mt-1">
				Crea e modifica gli account del sistema
			</p>
		</div>
		<Button
			onclick={openCreateDialog}
			class="bg-blue-600 hover:bg-blue-700"
		>
			<Plus size={16} class="mr-2" />
			Nuovo Utente
		</Button>
	</div>

	<!-- Error/Success Messages -->
	{#if form?.error}
		<div
			class="mb-4 p-3 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm"
		>
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div
			class="mb-4 p-3 bg-green-100 dark:bg-green-500/10 border border-green-300 dark:border-green-500/30 rounded-lg text-green-600 dark:text-green-400 text-sm"
		>
			Operazione completata con successo!
		</div>
	{/if}

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-3 mb-4">
		<!-- Search -->
		<div class="relative flex-1">
			<Search
				size={18}
				class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
			/>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Cerca per nome, username o email..."
				class="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all"
			/>
		</div>

		<!-- Role Filter -->
		<div class="relative">
			<Filter
				size={18}
				class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
			/>
			<select
				bind:value={roleFilter}
				class="w-full sm:w-48 pl-10 pr-8 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none cursor-pointer"
			>
				<option value="all">Tutti i ruoli</option>
				<option value="admin">Admin</option>
				<option value="staff">Staff</option>
				<option value="player">Player</option>
			</select>
		</div>
	</div>

	{#if selectedUserIds.length > 0}
		<div
			class="mb-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10 sm:flex-row sm:items-center sm:justify-between"
		>
			<span class="text-sm font-medium text-red-700 dark:text-red-300">
				{selectedUserIds.length}
				{selectedUserIds.length === 1
					? "utente selezionato"
					: "utenti selezionati"}
			</span>
			<div class="flex gap-2">
				<Button
					type="button"
					variant="ghost"
					onclick={() => (selectedUserIds = [])}
					class="flex-1 sm:flex-none"
				>
					Annulla selezione
				</Button>
				<Button
					type="button"
					variant="destructive"
					onclick={triggerBulkDelete}
					class="flex-1 sm:flex-none"
				>
					<Trash2 size={16} class="mr-2" />
					Elimina selezionati
				</Button>
			</div>
		</div>
	{/if}

	<!-- Table -->
	<div
		class="bg-card text-card-foreground border rounded-lg overflow-hidden shadow-sm"
	>
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="bg-muted/50 border-b">
					<tr>
						<th class="w-12 px-4 py-3 text-left">
							<input
								type="checkbox"
								checked={allFilteredUsersSelected()}
								disabled={selectableFilteredUsers().length === 0}
								use:indeterminate={someFilteredUsersSelected()}
								onchange={(event) =>
									toggleAllFilteredUsers(event.currentTarget.checked)}
								aria-label="Seleziona tutti gli utenti visibili"
								class="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-red-600 disabled:cursor-not-allowed disabled:opacity-40"
							/>
						</th>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>
							Utente
						</th>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>
							Accesso
						</th>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>
							Ruolo
						</th>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>
							Team
						</th>
						<th
							class="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>
							Azioni
						</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each filteredUsers() as user (user.id)}
						<tr
							class="transition-colors {selectedUserIds.includes(
								user.id,
							)
								? 'bg-red-50/70 dark:bg-red-500/10'
								: 'hover:bg-muted/50'}"
						>
							<td class="w-12 px-4 py-3">
								<input
									type="checkbox"
									checked={selectedUserIds.includes(user.id)}
									disabled={user.id === data.currentUser?.id}
									onchange={(event) =>
										toggleUserSelection(
											user.id,
											event.currentTarget.checked,
										)}
									aria-label={user.id === data.currentUser?.id
										? "Il tuo account non può essere selezionato"
										: `Seleziona ${user.name || user.username || user.email || "utente"}`}
									title={user.id === data.currentUser?.id
										? "Il tuo account non può essere eliminato"
										: undefined}
									class="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-red-600 disabled:cursor-not-allowed disabled:opacity-40"
								/>
							</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<div class="flex items-center gap-3">
									<img
										src={getAvatarUrl(
											user.avatarUrl,
											user.id,
											"user",
										)}
										alt={user.name ||
											user.username ||
											user.email ||
											"Avatar"}
										class="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm transition-shadow hover:shadow-md"
									/>
									<div class="min-w-0">
										<div
											class="font-medium truncate text-zinc-900 dark:text-zinc-100"
										>
											{user.name ||
												user.username ||
												user.email?.split("@")[0] ||
												"Utente"}
										</div>
									</div>
								</div>
							</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<div
									class="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-xs"
								>
									{#if user.username}
										<span class="font-mono font-semibold">@{user.username}</span>
									{/if}
									{#if user.email}
										<span class="block text-xs text-muted-foreground">{user.email}</span>
									{/if}
									{#if !user.username && !user.email}-{/if}
								</div>
							</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span
									class="inline-block px-2.5 py-1 text-xs font-medium rounded-full border {getRoleBadgeColor(
										user.role,
									)}"
								>
									{user.role.toUpperCase()}
								</span>
							</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<div class="text-sm text-foreground">
									{data.teams.find(
										(t) => t.id === user.teamId,
									)?.name || "-"}
								</div>
							</td>
							<td class="px-4 py-3 whitespace-nowrap text-right">
								<div
									class="flex items-center justify-end gap-1"
								>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openEditDialog(user)}
										class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
									>
										<Pencil size={14} />
									</Button>
									{#if user.id !== data.currentUser?.id}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => triggerDelete(user)}
											class="h-8 w-8 text-zinc-400 hover:text-red-500"
										>
											<Trash2 size={14} />
										</Button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if filteredUsers().length === 0}
			<div class="text-center py-12">
				<Users
					size={48}
					class="mx-auto text-zinc-300 dark:text-zinc-700 mb-3"
				/>
				<h3 class="text-lg font-semibold mb-1">
					Nessun utente trovato
				</h3>
				<p class="text-sm text-zinc-500 dark:text-zinc-400">
					{searchQuery || roleFilter !== "all"
						? "Prova a modificare i filtri"
						: "Crea il primo utente"}
				</p>
			</div>
		{/if}
	</div>

	<!-- Table Footer -->
	<div class="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
		Mostrando {filteredUsers().length} di {data.users.length} utenti
	</div>
</div>

<!-- Modal Dialog -->
{#if showDialog}
	<div
		class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4"
		onclick={(e: MouseEvent) =>
			e.target === e.currentTarget && closeDialog()}
		onkeydown={(e: KeyboardEvent) => e.key === "Escape" && closeDialog()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-card text-card-foreground border rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl relative my-auto animate-in zoom-in-95 duration-200"
		>
			<div
				class="flex items-center justify-between p-6 border-b bg-muted/30"
			>
				<div>
					<h2 class="text-xl font-bold">
						{editingUser ? "Modifica Utente" : "Nuovo Utente"}
					</h2>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onclick={closeDialog}
					class="h-10 w-10 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
				>
					<X size={20} />
				</Button>
			</div>

			<!-- Form -->
			<form
				action={editingUser ? "?/update" : "?/create"}
				method="POST"
				enctype="multipart/form-data"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						await update();
						isSubmitting = false;
						if (result.type === "success") closeDialog();
					};
				}}
				class="p-4 space-y-4"
			>
				{#if editingUser}
					<input type="hidden" name="id" value={editingUser.id} />
				{/if}
				<input type="hidden" name="avatarSeed" value={avatarSeed} />

				<!-- Avatar selection -->
				<div class="px-6 pt-2">
					<div class="flex flex-col gap-5 sm:flex-row sm:items-center">
						<img
							src={avatarPreview ||
								getAvatarUrl(
									editingUser?.avatarUrl,
									editingUser?.id || avatarVariantBase,
									"user",
								)}
							alt="Avatar preview"
							class="mx-auto h-24 w-24 shrink-0 rounded-full border-4 border-background object-cover shadow-lg sm:mx-0"
						/>
						<div class="min-w-0 flex-1 space-y-3">
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-sm font-semibold">Avatar Planets</h3>
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
							<div class="grid grid-cols-6 gap-2">
								{#each avatarVariants() as seed, index (seed)}
									<button
										type="button"
										onclick={() => selectPlanetAvatar(seed)}
										class="aspect-square min-w-0 overflow-hidden rounded-full border-2 transition-colors {avatarSeed === seed
											? 'border-blue-600 ring-2 ring-blue-600/20'
											: 'border-zinc-200 hover:border-zinc-400'}"
										aria-label={`Seleziona avatar ${index + 1}`}
										title={`Seleziona avatar ${index + 1}`}
									>
										<img
											src={planetAvatarUrl(seed)}
											alt=""
											class="h-full w-full object-cover"
										/>
									</button>
								{/each}
							</div>
							<Button
								type="button"
								variant="outline"
								onclick={() => avatarInput?.click()}
								class="h-9"
							>
								<Upload size={16} class="mr-2" />
								Carica immagine
							</Button>
						</div>
					</div>
					<input
						bind:this={avatarInput}
						type="file"
						name="avatar"
						accept="image/png,image/jpeg,image/gif,image/webp"
						onchange={handleAvatarChange}
						class="hidden"
					/>
				</div>

				<div class="p-6 space-y-4">
					{#if selectedRole === "player"}
						<div class="space-y-2">
							<label
								for="user-username"
								class="text-sm font-medium text-muted-foreground"
								>Username giocatore *</label
							>
							<input
								id="user-username"
								type="text"
								name="username"
								required
								minlength="3"
								maxlength="32"
								pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
								value={editingUser?.username || ""}
								placeholder="es: rdx4k7m2-1"
								autocomplete="off"
								autocapitalize="none"
								spellcheck="false"
								class="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all font-mono"
							/>
						</div>
					{/if}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="space-y-2">
							<label
								for="user-email"
								class="text-sm font-medium text-muted-foreground"
								>Email {selectedRole === "player" ? "(facoltativa)" : "*"}</label
							>
							<input
								id="user-email"
								type="email"
								name="email"
								required={selectedRole !== "player"}
								value={editingUser?.email || ""}
								placeholder="email@esempio.it"
								class="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all"
							/>
						</div>
						<div class="space-y-2">
							<label
								for="user-password"
								class="text-sm font-medium text-muted-foreground"
							>
								Password {editingUser
									? "(vuota per non cambiare)"
									: "*"}
							</label>
							<input
								id="user-password"
								type="password"
								name="password"
								required={!editingUser}
								placeholder="••••••••"
								class="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="space-y-2">
							<label
								for="user-name"
								class="text-sm font-medium text-muted-foreground"
								>Nome Completo</label
							>
							<input
								id="user-name"
								type="text"
								name="name"
								value={editingUser?.name || ""}
								placeholder="Mario Rossi"
								class="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all"
							/>
						</div>
						<div class="space-y-2">
							<label
								for="user-role"
								class="text-sm font-medium text-muted-foreground"
								>Ruolo *</label
							>
							<select
								id="user-role"
								name="role"
								required
								bind:value={selectedRole}
								disabled={editingUser?.id === data.currentUser?.id}
								class="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
							>
								<option value="admin">Admin</option>
								<option value="staff">Staff</option>
								<option value="player">Player</option>
							</select>
							{#if editingUser?.id === data.currentUser?.id}
								<input type="hidden" name="role" value={selectedRole} />
								<p class="text-xs text-zinc-500 dark:text-zinc-400">
									Il tuo ruolo non può essere cambiato da questa sessione.
								</p>
							{/if}
						</div>
					</div>

					{#if selectedRole === "player"}
						<div class="space-y-2">
							<label
								for="user-team"
								class="text-sm font-medium text-muted-foreground"
								>Assegna a Team</label
							>
							<select
								id="user-team"
								name="teamId"
								value={editingUser?.teamId || ""}
								class="w-full px-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all appearance-none"
							>
								<option value="">Nessun Team</option>
								{#each data.teams as team}
									<option value={team.id}>{team.name}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>

				<div class="p-6 bg-muted/30 border-t flex justify-end gap-3">
					<Button
						type="button"
						variant="ghost"
						onclick={closeDialog}
						class="px-6"
						disabled={isSubmitting}
					>
						Annulla
					</Button>
					<Button
						type="submit"
						class="px-8 shadow-lg shadow-primary/20"
						disabled={isSubmitting}
					>
						{isSubmitting
							? "Salvataggio..."
							: editingUser
								? "Salva Modifiche"
								: "Crea Utente"}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Custom Delete Confirmation Dialog -->
{#if showDeleteDialog && (userToDelete || selectedUserIds.length > 0)}
	<div
		class="fixed inset-0 bg-red-950/20 dark:bg-black/80 backdrop-blur-sm z-60 flex items-start justify-center p-4"
		onclick={(e: MouseEvent) =>
			e.target === e.currentTarget && closeDeleteDialog()}
		onkeydown={(e: KeyboardEvent) =>
			e.key === "Escape" && closeDeleteDialog()}
		role="presentation"
	>
		<div
			class="bg-card text-card-foreground border-2 border-red-500/20 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto shadow-2xl relative animate-in zoom-in-95 duration-200"
		>
			<div class="p-6 text-center space-y-4">
				<div
					class="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400"
				>
					<Trash2 size={32} />
				</div>
				<div>
					<h2 class="text-xl font-bold">
						{userToDelete
							? "Conferma Eliminazione"
							: `Elimina ${selectedUserIds.length} utenti`}
					</h2>
					<p class="text-sm text-muted-foreground mt-2">
						{#if userToDelete}
							Sei sicuro di voler eliminare l'utente <span
								class="font-bold text-foreground"
								>{userToDelete.name ||
									userToDelete.username ||
									userToDelete.email}</span
							>?
						{:else}
							Sei sicuro di voler eliminare definitivamente tutti gli
							utenti selezionati?
						{/if}
						Questa azione non può essere annullata.
					</p>
				</div>
			</div>
			<div class="p-6 bg-muted/30 border-t flex gap-3">
				<Button
					variant="ghost"
					onclick={closeDeleteDialog}
					class="flex-1"
				>
					Annulla
				</Button>
				<form
					action={userToDelete ? "?/delete" : "?/deleteMany"}
					method="POST"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result, update }) => {
							await update();
							isSubmitting = false;
							if (result.type === "success") {
								selectedUserIds = userToDelete
									? selectedUserIds.filter(
											(id) => id !== userToDelete?.id,
										)
									: [];
							}
							closeDeleteDialog();
						};
					}}
					class="flex-1"
				>
					{#if userToDelete}
						<input type="hidden" name="id" value={userToDelete.id} />
					{:else}
						{#each selectedUserIds as id (id)}
							<input type="hidden" name="ids" value={id} />
						{/each}
					{/if}
					<Button
						type="submit"
						variant="destructive"
						class="w-full shadow-lg shadow-destructive/20"
						disabled={isSubmitting}
					>
						{isSubmitting
							? "Eliminazione..."
							: userToDelete
								? "Elimina Utente"
								: "Elimina selezionati"}
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
