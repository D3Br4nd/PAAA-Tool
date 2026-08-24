export const CLAIM_GEO_SESSION_SQL = `
	INSERT INTO team_geo_sessions (team_id, user_id, session_id, acquired_at, last_seen_at)
	VALUES (?, ?, ?, ?, ?)
	ON CONFLICT(team_id) DO UPDATE SET
		user_id = excluded.user_id,
		session_id = excluded.session_id,
		acquired_at = CASE
			WHEN team_geo_sessions.session_id = excluded.session_id
			THEN team_geo_sessions.acquired_at
			ELSE excluded.acquired_at
		END,
		last_seen_at = excluded.last_seen_at
	WHERE team_geo_sessions.session_id = excluded.session_id
		OR team_geo_sessions.last_seen_at < ?
	RETURNING team_id
`;
