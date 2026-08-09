import { cn } from "@/lib/utils";

// Componente de servidor — sem "use client". Renderiza o SVG vetorizado da marca AMASSA
// (fornecido pelo dono do ateliê, via potrace) fechando D-13 — antes deste componente, a
// palavra "AMASSA" era desenhada como texto em Archivo Narrow, um substituto provisório
// enquanto o dono não exportava a Vinila Condensed do mídia kit.
//
// `role="img"` + `aria-label="AMASSA"` no <svg> dão ao desenho o mesmo nome acessível que o
// texto tinha — é assim que `getByRole("heading", { name: "AMASSA" })`
// (tests/e2e/fundacao.spec.ts) continua resolvendo quando `Logo` é renderizado como `h1`: o
// nome acessível de um heading vem do conteúdo, e o conteúdo aqui é uma imagem com aria-label
// próprio. `focusable="false"` tira o <svg> da ordem de tabulação no IE/Edge legado (padrão
// morto em navegadores modernos, mas inofensivo manter).
//
// `fill="currentColor"` substitui o preto do potrace (`#000000`) — a marca herda a cor do
// texto ao redor (`text-foreground` aqui, ou o que `className` sobrescrever), em vez de ficar
// presa a um preto que não é a tinta do AMASSA (`#1D2221`).
//
// Sem `width`/`height` fixos: o <svg> usa `h-[1em] w-auto`, herdando o tamanho de fonte do
// elemento pai (o `Elemento` abaixo). É o que faz o MESMO componente funcionar em duas escalas
// sem tocar em quem o usa — a barra lateral (sem className de tamanho, usa o tamanho de fonte
// herdado do contexto) e o cartão de login (`className="text-4xl"`, que já existia para
// dimensionar o texto antigo e agora dimensiona o desenho do mesmo jeito, via `em`).
export type LogoProps = {
  como?: "h1" | "span";
  className?: string;
};

export function Logo({ como = "span", className }: LogoProps) {
  const Elemento = como;

  return (
    <Elemento className={cn("text-foreground", className)}>
      <svg
        role="img"
        aria-label="AMASSA"
        focusable="false"
        viewBox="0 0 855 167"
        preserveAspectRatio="xMidYMid meet"
        className="h-[1em] w-auto"
      >
        <g transform="translate(0,167) scale(0.1,-0.1)" fill="currentColor" stroke="none">
          <path
            d="M461 1488 c-118 -370 -361 -1196 -361 -1228 l0 -40 197 2 198 3 20
62 c11 34 25 67 31 73 7 7 81 10 220 8 l209 -3 23 -73 24 -72 196 2 197 3 3
35 c2 23 -57 231 -177 625 -100 325 -185 600 -191 613 l-10 22 -284 0 -284 0
-11 -32z m319 -338 c7 -13 84 -351 97 -424 4 -18 1 -31 -8 -37 -20 -12 -213
-11 -225 1 -8 8 -2 46 17 126 16 64 38 164 49 222 12 59 23 113 26 120 5 17
35 12 44 -8z"
          />
          <path
            d="M1545 1508 c-3 -7 -4 -299 -3 -648 l3 -635 185 0 185 0 0 95 c0 52
-4 238 -8 413 -8 290 -7 318 8 323 9 4 21 2 27 -4 6 -6 47 -190 92 -409 45
-219 85 -404 90 -411 5 -9 59 -12 206 -12 l199 0 10 38 c5 20 45 208 88 417
72 351 80 380 99 383 12 2 23 -3 26 -10 2 -7 1 -121 -3 -253 -4 -132 -8 -315
-8 -407 l-1 -168 179 0 c154 0 180 2 185 16 8 20 8 1248 0 1268 -5 14 -42 16
-305 16 -231 0 -301 -3 -304 -12 -2 -7 -34 -182 -70 -387 -36 -206 -70 -380
-75 -385 -7 -7 -16 -7 -27 0 -13 8 -32 95 -83 385 -36 206 -69 380 -73 387 -6
9 -80 12 -313 12 -234 0 -306 -3 -309 -12z"
          />
          <path
            d="M3595 1508 c-36 -94 -375 -1239 -373 -1257 l3 -26 199 0 200 0 19 65
c11 36 24 68 31 72 6 4 101 8 211 8 110 0 205 -4 211 -8 6 -4 20 -36 30 -72
l20 -65 199 0 200 0 3 30 c2 18 -75 285 -186 645 l-188 615 -287 3 c-225 2
-289 0 -292 -10z m309 -347 c4 -5 15 -54 26 -108 11 -54 34 -156 51 -227 26
-106 29 -130 18 -137 -18 -11 -210 -11 -227 0 -11 6 -8 32 17 132 16 68 40
171 51 228 12 58 23 108 26 113 7 11 31 10 38 -1z"
          />
          <path
            d="M5003 1506 c-234 -45 -363 -191 -363 -411 0 -184 82 -312 234 -366
31 -11 150 -33 264 -49 261 -38 260 -37 273 -63 10 -17 8 -24 -12 -40 -22 -18
-36 -19 -209 -14 -102 3 -256 15 -343 27 -123 16 -162 18 -173 9 -12 -10 -14
-44 -12 -178 l3 -166 28 -13 c37 -18 369 -36 532 -28 281 12 442 91 517 252
62 132 48 330 -30 433 -45 59 -54 66 -131 103 -54 27 -97 36 -295 65 -181 26
-235 38 -250 52 -18 18 -18 19 3 40 13 13 35 21 59 22 106 3 254 -4 401 -17
123 -11 167 -12 177 -3 11 9 14 47 14 170 0 154 -1 159 -22 171 -35 18 -570
22 -665 4z"
          />
          <path
            d="M6215 1505 c-143 -26 -248 -86 -303 -173 -40 -62 -50 -91 -62 -171
-21 -146 29 -298 121 -371 73 -58 134 -75 375 -110 120 -17 231 -36 247 -42
34 -13 37 -52 5 -69 -32 -17 -356 -5 -547 21 -115 15 -157 17 -167 9 -11 -9
-14 -50 -14 -180 l0 -169 26 -11 c42 -15 386 -32 535 -25 214 10 341 51 439
142 85 79 128 204 116 341 -11 139 -70 240 -173 295 -66 36 -99 43 -337 78
-114 16 -216 34 -226 40 -33 18 -23 52 20 65 36 12 237 7 428 -10 89 -8 169
-12 177 -8 9 3 18 15 21 28 8 32 1 302 -9 311 -25 25 -547 32 -672 9z"
          />
          <path
            d="M7421 1503 c-5 -10 -91 -286 -191 -615 -119 -392 -180 -608 -178
-630 l3 -33 191 -3 c145 -2 194 1 201 10 5 7 16 36 23 63 7 28 17 56 23 63 14
17 420 17 434 0 6 -7 16 -35 23 -63 7 -27 17 -56 23 -62 7 -10 60 -13 203 -13
l194 0 0 41 c0 41 -353 1220 -373 1247 -7 9 -77 12 -288 12 -255 0 -279 -1
-288 -17z m306 -345 c5 -7 20 -62 33 -123 12 -60 35 -160 50 -222 19 -78 24
-115 16 -123 -11 -11 -193 -14 -220 -4 -21 8 -20 22 7 134 13 52 34 147 47
210 22 109 33 140 50 140 4 0 12 -6 17 -12z"
          />
        </g>
      </svg>
    </Elemento>
  );
}
