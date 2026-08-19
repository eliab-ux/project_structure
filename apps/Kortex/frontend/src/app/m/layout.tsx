'use client';

import { RunningCutBadge } from 'src/components/RunningCutBadge';

/**
 * Moldura do app do Modelista.
 *
 * Existe por um motivo só: pendurar o indicador de matriz em andamento em **todas** as telas dele.
 * Antes cada página de `/m` era independente, e o cronômetro só existia dentro da tela da matriz —
 * sair dela era perder o corte de vista.
 *
 * Não há barra de navegação aqui de propósito. A tela do Modelista é operada de pé, na máquina, e
 * cada uma dela já leva de volta para onde precisa; um menu lateral seria alvo de toque disputando
 * espaço com os botões que importam.
 */
export default function ModelistaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RunningCutBadge />
    </>
  );
}
