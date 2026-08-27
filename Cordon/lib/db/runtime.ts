type PrismaLike = {
  $transaction<T>(callback: (database: unknown) => Promise<T>): Promise<T>;
  scan: {
    findUnique(input: Record<string, unknown>): Promise<unknown>;
    findMany(input: Record<string, unknown>): Promise<unknown>;
    deleteMany(input: Record<string, unknown>): Promise<unknown>;
  };
  inspection: {
    upsert(input: Record<string, unknown>): Promise<unknown>;
    findUnique(input: Record<string, unknown>): Promise<unknown>;
    findMany(input: Record<string, unknown>): Promise<unknown>;
    deleteMany(input: Record<string, unknown>): Promise<unknown>;
  };
  quarantinePlan: {
    create(input: Record<string, unknown>): Promise<unknown>;
    findUnique(input: Record<string, unknown>): Promise<unknown>;
    findFirst(input: Record<string, unknown>): Promise<unknown>;
  };
  quarantineRun: {
    create(input: Record<string, unknown>): Promise<unknown>;
    update(input: Record<string, unknown>): Promise<unknown>;
    findUnique(input: Record<string, unknown>): Promise<unknown>;
    findFirst(input: Record<string, unknown>): Promise<unknown>;
    findMany(input: Record<string, unknown>): Promise<unknown>;
  };
};

type PrismaConstructor = new () => PrismaLike;

const globalForPrisma = globalThis as unknown as { cordonPrisma?: PrismaLike };

export async function loadPrisma(): Promise<PrismaLike> {
  if (globalForPrisma.cordonPrisma) return globalForPrisma.cordonPrisma;

  // Keep Prisma optional for zero-setup development. The variable specifier prevents
  // the Next.js bundle from resolving the generated client when DATABASE_URL is absent.
  const packageName = ["@prisma", "client"].join("/");
  const prismaPackage = (await import(packageName)) as { PrismaClient: PrismaConstructor };
  const client = new prismaPackage.PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.cordonPrisma = client;
  return client;
}
