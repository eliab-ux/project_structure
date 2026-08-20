'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { FONT_MONO } from 'src/theme/theme';

/**
 * A mesa de corte vista de cima — o painel escuro das telas de acesso.
 *
 * Não é ornamento genérico: é um encaixe de verdade. O retângulo é o enfesto, as formas são peças
 * de uma camisa aninhadas (frentes, costas, mangas, gola, punhos, bolso), as linhas tracejadas
 * finas são o sentido do fio, e o traço laranja é o caminho que a lâmina percorre, com o cabeçote
 * andando sobre ele. Quem opera a máquina reconhece a tela antes de ler qualquer palavra.
 *
 * **Nada aqui é dado de conta.** É tela pré-autenticação: número de máquinas, horário de
 * funcionamento ou nome de cliente ficariam desatualizados no dia seguinte ao primeiro cadastro,
 * mentindo para todo mundo que abrisse o endereço — e sem ninguém para notar.
 *
 * `aria-hidden`: para leitor de tela isto é decoração, e descrever o desenho peça por peça só
 * atrasaria quem quer chegar ao campo de e-mail.
 */

/** Marca a cada 10 cm; número a cada 50. 41 traços cobrem a largura em passos de 2,5%. */
const TICKS = Array.from({ length: 41 }, (_, index) => ({
  index,
  left: `${index * 2.5}%`,
  major: index % 5 === 0,
}));

export function CuttingTable() {
  return (
    <Box
      component="section"
      aria-hidden="true"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'primary.main',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        px: { xs: 3.25, md: 5.5 },
        pt: { xs: 3.25, md: 4.75 },
        pb: { xs: 2.75, md: 4.25 },
        minHeight: { xs: 250, md: 'auto' },
      }}
    >
      {/* Régua da borda da mesa. */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 26,
          borderBottom: '1px solid',
          borderColor: 'rgba(255,255,255,.09)',
        }}
      >
        {TICKS.map((tick) => (
          <Box key={tick.index} component="span">
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: tick.left,
                width: '1px',
                height: tick.major ? 13 : 7,
                bgcolor: 'rgba(255,255,255,.16)',
              }}
            />
            {tick.major && tick.index > 0 && (
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  top: 13,
                  left: tick.left,
                  transform: 'translateX(-50%)',
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '.04em',
                  color: 'rgba(255,255,255,.34)',
                }}
              >
                {tick.index * 10} cm
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box
        component="svg"
        viewBox="0 0 700 470"
        xmlns="http://www.w3.org/2000/svg"
        // `sx` como FUNÇÃO, e as cores resolvidas à mão: o `sx` do MUI só traduz caminho de
        // paleta (`error.main`) em propriedades de cor que ele conhece — `color`, `bgcolor`,
        // `borderColor`. Em `fill` e `stroke` ele passa a string crua, e o navegador descarta a
        // regra inteira por ser inválida. O sintoma é traiçoeiro: nada quebra, o desenho
        // simplesmente aparece sem contorno e o cabeçote fica preto sobre fundo escuro.
        sx={(theme) => ({
          position: 'absolute',
          zIndex: 1,
          opacity: { xs: 0.5, md: 0.92 },
          right: { xs: -90, md: -40 },
          top: { xs: 'auto', md: '50%' },
          bottom: { xs: -70, md: 'auto' },
          transform: { xs: 'none', md: 'translateY(-46%)' },
          width: { xs: '82%', md: '74%' },
          maxWidth: 640,
          '& .piece': {
            fill: alpha(theme.palette.info.main, 0.07),
            stroke: theme.palette.info.main,
            strokeWidth: 1.4,
            strokeDasharray: '7 5',
          },
          '& .spread': { fill: 'none', stroke: 'rgba(255,255,255,.16)', strokeWidth: 1 },
          '& .grain': {
            stroke: alpha(theme.palette.info.main, 0.4),
            strokeWidth: 1,
            strokeDasharray: '2 4',
          },
          '& .reg': { stroke: 'rgba(255,255,255,.3)', strokeWidth: 1 },
          '& .lbl': {
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            fill: 'rgba(255,255,255,.38)',
            letterSpacing: '.06em',
          },
          /**
           * O cabeçote anda por `offset-path` do CSS, não por `<animateMotion>` do SMIL.
           *
           * SMIL não se controla por media query: para respeitar `prefers-reduced-motion` a única
           * saída era `display: none`, e aí o ponto SUMIA para quem pede menos movimento — some o
           * elemento em vez de acalmá-lo. Com CSS, tirar a animação deixa o cabeçote parado no
           * início do corte, visível.
           *
           * De quebra, resolve a compatibilidade: `href` em `<mpath>` é SVG2 e só o Chromium
           * honra; Firefox e Safari exigiam `xlink:href`.
           */
          '& .head': {
            fill: theme.palette.error.main,
            offsetPath: `path('M40 92 H310 M334 92 H674 M674 198 H506 M506 224 H674 M674 340 H506 M476 318 H334 M310 318 H30 M30 348 H330 M330 412 H40 M348 348 H562 M576 404 H672')`,
            offsetRotate: '0deg',
            animation: 'kortex-head 16s linear infinite',
          },
          '@keyframes kortex-head': {
            from: { offsetDistance: '0%' },
            to: { offsetDistance: '100%' },
          },
          '& .trace': {
            fill: 'none',
            stroke: theme.palette.error.main,
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeDasharray: 1900,
            strokeDashoffset: 1900,
            animation: 'kortex-cut 16s linear infinite',
          },
          '@keyframes kortex-cut': { to: { strokeDashoffset: 0 } },
          // Movimento contínuo atrapalha quem tem sensibilidade vestibular, e esta é a porta de
          // entrada do sistema: o desenho continua legível parado, com o corte inteiro visível.
          // Menos movimento: o corte aparece inteiro e o cabeçote fica parado no começo dele.
          // Nada some — a tela continua contando a mesma coisa, sem nada se mexendo.
          '@media (prefers-reduced-motion: reduce)': {
            '& .trace': { animation: 'none', strokeDashoffset: 0, opacity: 0.55 },
            '& .head': { animation: 'none' },
          },
        })}
      >
        <rect className="spread" x="16" y="34" width="668" height="404" rx="3" />
        <text className="lbl" x="16" y="24">
          enc_camisa_40pc · 1,60 m · 50 camadas
        </text>

        {/* Marcas de registro do plotter. */}
        <g className="reg">
          <path d="M16 34 h14 M16 34 v14" />
          <path d="M684 34 h-14 M684 34 v14" />
          <path d="M16 438 h14 M16 438 v-14" />
          <path d="M684 438 h-14 M684 438 v-14" />
        </g>

        {/* Peças aninhadas: frentes, costas, mangas, gola, punhos, bolso. */}
        <path
          className="piece"
          d="M40 92 h108 q10 0 10 10 v206 q0 10 -10 10 h-108 q-10 0 -10 -10 v-142
            q0 -22 18 -34 l14 -10 q6 -4 6 -12 v-8 q0 -10 10 -10 z"
        />
        <path
          className="piece"
          d="M300 92 h-108 q-10 0 -10 10 v206 q0 10 10 10 h108 q10 0 10 -10 v-142
            q0 -22 -18 -34 l-14 -10 q-6 -4 -6 -12 v-8 q0 -10 -10 -10 z"
        />
        <path
          className="piece"
          d="M334 92 h132 q10 0 10 10 v206 q0 10 -10 10 h-132 q-10 0 -10 -10 v-176
            q0 -14 12 -20 l10 -6 q6 -4 6 -14 z"
        />
        <path
          className="piece"
          d="M506 92 h158 q10 0 10 10 v96 q0 10 -10 10 h-158 q-10 0 -10 -10 v-40
            q0 -16 14 -24 l16 -10 q4 -3 4 -10 v-12 q0 -10 -12 -10 z"
        />
        <path
          className="piece"
          d="M506 224 h158 q10 0 10 10 v96 q0 10 -10 10 h-158 q-10 0 -10 -10 v-40
            q0 -16 14 -24 l16 -10 q4 -3 4 -10 v-12 q0 -10 -12 -10 z"
        />
        <path
          className="piece"
          d="M40 348 h280 q10 0 10 10 v44 q0 10 -10 10 h-280 q-10 0 -10 -10 v-44
            q0 -10 10 -10 z"
        />
        <path
          className="piece"
          d="M348 348 h92 q8 0 8 8 v48 q0 8 -8 8 h-92 q-8 0 -8 -8 v-48 q0 -8 8 -8 z"
        />
        <path
          className="piece"
          d="M462 348 h92 q8 0 8 8 v48 q0 8 -8 8 h-92 q-8 0 -8 -8 v-48 q0 -8 8 -8 z"
        />
        <path
          className="piece"
          d="M576 356 h88 q8 0 8 8 v40 q0 8 -8 8 h-88 q-8 0 -8 -8 v-40 q0 -8 8 -8 z"
        />

        {/* Sentido do fio. */}
        <g className="grain">
          <path d="M94 120 v170" />
          <path d="M246 120 v170" />
          <path d="M400 120 v170" />
          <path d="M585 116 v78" />
          <path d="M585 248 v78" />
        </g>

        {/* Caminho de corte e o cabeçote andando sobre ele. */}
        <path
          id="kortex-cutpath"
          className="trace"
          d="M40 92 H310 M334 92 H674 M674 198 H506 M506 224 H674 M674 340 H506
             M476 318 H334 M310 318 H30 M30 348 H330 M330 412 H40 M348 348 H562 M576 404 H672"
        />
        {/* O cabeçote. Centrado em (0,0) porque quem o posiciona é o `offset-path` do CSS. */}
        <rect className="head" x="-7" y="-7" width="14" height="14" rx="2.5" />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 3 }}>
        <Typography
          component="p"
          sx={{
            fontFamily: (theme) => theme.typography.h1.fontFamily,
            fontWeight: 800,
            fontSize: 'clamp(48px, 6.4vw, 84px)',
            letterSpacing: '-.045em',
            lineHeight: 0.86,
            color: 'common.white',
            m: 0,
          }}
        >
          Kor
          {/* O t laranja é a lâmina no meio do nome. */}
          <Box component="span" sx={{ color: 'error.main' }}>
            t
          </Box>
          ex
        </Typography>
        <Typography
          component="p"
          sx={{
            color: 'rgba(255,255,255,.62)',
            fontSize: 16,
            lineHeight: 1.5,
            maxWidth: '34ch',
            mt: 2,
            display: { xs: 'none', md: 'block' },
          }}
        >
          Hora de máquina de corte, do pré-pedido ao apontamento na mesa.
        </Typography>
      </Box>
    </Box>
  );
}
