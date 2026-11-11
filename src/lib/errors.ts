/** Turns Supabase/PostgREST/Postgres errors into short messages a person can act on. */
export function errMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const e = err as { message?: string; code?: string; details?: string };
  switch (e.code) {
    case "23505":
      return "That already exists.";
    case "42501":
      return "You don't have permission to do that.";
    case "23514":
      return "Some of the details are outside the allowed range. Please check the form.";
    case "PGRST116":
      return "We couldn't find that.";
  }
  if (e.message && !/^(JWT|fetch failed|TypeError)/i.test(e.message)) return e.message;
  return fallback;
}
