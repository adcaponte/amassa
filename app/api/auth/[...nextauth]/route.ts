import { handlers } from "@/lib/auth/auth";

// Runtime Node explícito: esta rota alcança `lib/auth/auth.ts`, que usa o módulo nativo de
// hash e o cliente do banco — nenhum dos dois carrega no runtime Edge.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
