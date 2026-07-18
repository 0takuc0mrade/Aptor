import { handleDeliveryRequest } from "@aptor/delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<{ path: string[] }> }>;

async function handle(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  return handleDeliveryRequest(request, path);
}

export { handle as GET, handle as PATCH, handle as POST };
