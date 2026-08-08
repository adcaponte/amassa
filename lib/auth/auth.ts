// A metade de runtime Node da configuração do Auth.js. Importa `configuracaoBase` e
// acrescenta o provedor de credenciais, o hash e o banco — é o que rotas, páginas e Server
// Actions importam. NUNCA o middleware (ver `lib/auth/auth.config.ts` e
// `tests/unit/auth-borda.test.ts`).
import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/db";
import { usuarios } from "@/db/schema";

import { configuracaoBase } from "./auth.config";
import { avaliarCredenciais } from "./credenciais";
import { credenciaisEntradaSchema } from "./entrada-credenciais";
import { conferirHash, gerarHash } from "./senha";
import { avaliarPedidoAgora, registrarAcertoAgora, registrarErroAgora } from "./tentativas-memoria";

// Hash de referência para o caminho sem usuário: gerado uma única vez, na inicialização do
// processo, a partir de um valor aleatório descartado em seguida — nunca uma constante
// escrita no arquivo, que num repositório público seria um convite a conferir o custo do
// parâmetro. Existe só para igualar o tempo de resposta (T-02a-14), não para autenticar
// ninguém.
const hashDeReferenciaPromise = gerarHash(randomBytes(32).toString("hex"));

// Segunda mensagem, distinta da de credenciais inválidas: bloqueio não é senha errada, e
// esconder o bloqueio faria a pessoa certa achar que esqueceu a própria senha. `code` vira o
// parâmetro `code` da URL de erro do Auth.js, mas como `lib/auth/acoes.ts` chama `signIn`
// dentro de uma Server Action e captura a exceção no mesmo processo (não via redirect do
// framework), a instância chega intacta ao `catch`, com `segundosParaLiberar` preservado.
export class ErroBloqueado extends CredentialsSignin {
  code = "bloqueado";
  segundosParaLiberar: number;

  constructor(segundosParaLiberar: number) {
    super();
    this.segundosParaLiberar = segundosParaLiberar;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...configuracaoBase,
  providers: [
    Credentials({
      credentials: {
        email: {},
        senha: {},
      },
      async authorize(credenciaisBrutas) {
        const resultado = credenciaisEntradaSchema.safeParse(credenciaisBrutas);
        if (!resultado.success) return null;

        const email = resultado.data.email.toLowerCase();

        // 1. O contador em memória decide ANTES de qualquer consulta ao banco — bloqueio não
        // é credencial inválida, e não consultar o banco neste caminho evita que a decisão de
        // bloqueio vaze pelo tempo de resposta.
        const decisaoDeTentativas = avaliarPedidoAgora(email);
        if (!decisaoDeTentativas.liberado) {
          throw new ErroBloqueado(decisaoDeTentativas.segundosParaLiberar);
        }

        // 2. Busca por lower(email), aproveitando o índice funcional.
        const [usuario] = await db
          .select()
          .from(usuarios)
          .where(eq(sql`lower(${usuarios.email})`, email))
          .limit(1);

        // 3. Avaliação de credenciais em tempo constante (lib/auth/credenciais.ts), injetando
        // a conferência de hash real de lib/auth/senha.ts.
        const hashDeReferencia = await hashDeReferenciaPromise;
        const resultadoCredenciais = await avaliarCredenciais(
          usuario,
          resultado.data.senha,
          conferirHash,
          hashDeReferencia,
        );

        // 4. Registra erro ou acerto no contador conforme o resultado, e devolve.
        if (!resultadoCredenciais.autenticado) {
          registrarErroAgora(email);
          return null;
        }
        registrarAcertoAgora(email);

        const { usuario: usuarioAutenticado } = resultadoCredenciais;
        return { id: usuarioAutenticado.id, name: usuarioAutenticado.nome, email: usuarioAutenticado.email };
      },
    }),
  ],
});
