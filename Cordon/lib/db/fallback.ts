let lastDatabaseError: string | null = null;

export async function withDatabaseFallback<T>(operation: () => Promise<T>, fallback: () => Promise<T> | T): Promise<T> {
  try {
    const value = await operation();
    lastDatabaseError = null;
    return value;
  } catch (error) {
    lastDatabaseError = error instanceof Error ? error.message.slice(0, 500) : "Database operation failed.";
    return fallback();
  }
}

export function persistenceReadiness(): { mode: "database" | "memory"; degraded: boolean; message: string } {
  if (!process.env.DATABASE_URL) {
    return { mode: "memory", degraded: false, message: "Cordon is using in-memory persistence for this process." };
  }
  if (lastDatabaseError) {
    return { mode: "memory", degraded: true, message: "The database is unavailable. Cordon preserved current state in memory; it may be lost when the application restarts." };
  }
  return { mode: "database", degraded: false, message: "Cordon is using database-backed persistence." };
}
