type ActivityUser = Pick<App.SessionUser, 'role' | 'teamId' | 'authMethod'>;

export function hasPasswordActivityAccess(user: ActivityUser | null): boolean {
	return user?.authMethod === 'password';
}

/** Join-code sessions are valid only for activities scoped to their signed team id. */
export function hasTeamActivityAccess(user: ActivityUser | null): boolean {
	return user?.role === 'player' && Boolean(user.teamId);
}
