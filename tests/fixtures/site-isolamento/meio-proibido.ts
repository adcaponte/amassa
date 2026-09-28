// Segundo salto da fixture — importa "@/db" de propósito, para o teste provar que a violação
// é detectada mesmo quando não está no arquivo de entrada, e que a mensagem nomeia a cadeia
// inteira (entrada-proibida.ts -> meio-proibido.ts -> "@/db").
import { db } from "@/db";

export const algo = db;
