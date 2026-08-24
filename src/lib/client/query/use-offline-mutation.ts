import { createMutation, type CreateMutationOptions, useQueryClient } from '@tanstack/svelte-query';
import { enqueueMutation } from '$lib/client/sync/mutation-queue';

export type OfflineMutationOptions<TData, TVariables> = {
  /**
   * A stable mutation type string stored in the outbox.
   * Example: "team.completed_challenge"
   */
  type: string;

  /**
   * Apply the change locally (SQLite) so the app works offline.
   * This should be idempotent if possible.
   */
  applyLocal: (variables: TVariables) => Promise<void> | void;

  /**
   * Push the mutation to the server when online.
   * Your backend should be idempotent (use mutation id, request id, etc.).
   */
  pushRemote: (variables: TVariables) => Promise<TData>;

  /**
   * Optional hook for optimistic cache updates (TanStack Query).
   */
  onLocalApplied?: (variables: TVariables, queryClient: ReturnType<typeof useQueryClient>) => void;
};

/**
 * A small wrapper around TanStack Svelte Query's mutation that:
 * - always writes locally first (SQLite/OPFS)
 * - if offline, enqueues to mutation_queue and returns a "local-only" result
 * - if online, also pushes to backend immediately
 */
export function useOfflineMutation<TData = unknown, TVariables = unknown>(
  opts: OfflineMutationOptions<TData, TVariables>,
  queryOpts?: Omit<CreateMutationOptions<TData, unknown, TVariables, unknown>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return createMutation<TData, unknown, TVariables>(() => ({
    ...queryOpts,
    mutationFn: async (variables: TVariables) => {
      // 1) Always apply locally so UI is consistent offline
      await opts.applyLocal(variables);
      opts.onLocalApplied?.(variables, queryClient);

      // 2) If offline: enqueue and short-circuit
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueueMutation(opts.type, variables);
        // Return "undefined as TData" for now; callers should rely on cache/local reads.
        return undefined as TData;
      }

      // 3) Online: push to backend. If it fails (transient), enqueue for later.
      try {
        return await opts.pushRemote(variables);
      } catch (err) {
        await enqueueMutation(opts.type, variables);
        throw err;
      }
    }
  }));
}


