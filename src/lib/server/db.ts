import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

/**
 * PAAA-Tool Database Initialization
 */

type GlobalDbCache = {
	__paaa_libsql_client__?: Client;
	__paaa_drizzle_db__?: ReturnType<typeof drizzle<typeof schema>>;
};

const globalDbCache = globalThis as unknown as GlobalDbCache;

export const libsqlClient: Client =
	globalDbCache.__paaa_libsql_client__ ??
	createClient({
		url: env.DATABASE_URL || 'http://db:8080',
		// Canonical name is DATABASE_AUTH_TOKEN (matches docker-compose);
		// AUTH_TOKEN kept as legacy fallback.
		authToken: env.DATABASE_AUTH_TOKEN || env.AUTH_TOKEN || undefined
	});

globalDbCache.__paaa_libsql_client__ = libsqlClient;

export const db =
	globalDbCache.__paaa_drizzle_db__ ??
	drizzle(libsqlClient, { schema });

globalDbCache.__paaa_drizzle_db__ = db;


