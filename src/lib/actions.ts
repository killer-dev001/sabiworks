import { useState } from "react";
import { toast } from "sonner";
import { errMessage } from "@/lib/errors";
import { useRefreshAll } from "@/lib/data";

type Result = { error: { message: string; code?: string } | null };

/**
 * Runs a server action (RPC / insert / update), tracks which one is busy, shows a toast and
 * refreshes cached data. Returns true when the action succeeded.
 */
export function useAction() {
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(
    key: string,
    fn: () => PromiseLike<Result>,
    success?: string,
  ): Promise<boolean> {
    setBusy(key);
    try {
      const { error } = await fn();
      if (error) throw error;
      if (success) toast.success(success);
      await refresh();
      return true;
    } catch (e) {
      toast.error(errMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return { run, busy, isBusy: (key: string) => busy === key, anyBusy: busy !== null };
}
