'use client';

import { useState } from 'react';
import { useSnackbar } from 'notistack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { RolePhrasePanel } from 'src/components/RolePhrasePanel';
import { apiErrorMessage } from 'src/services/api';
import roleService from 'src/services/roleService';
import { PermissionPhraseReading, Role } from 'src/types/admin';

/**
 * A entrada por frase da tela de Papéis (§5.1) — escrever, conferir, aplicar.
 *
 * São três passos, os mesmos da Mesa e pela mesma razão: **traduzir não é gravar**. O `read-phrase`
 * não escreve nada; quem escreve é o `PATCH /roles/:id`, com `roles.update`, o mesmo endpoint que a
 * árvore completa usa. A frase é uma forma de PREENCHER o formulário, nunca um segundo caminho de
 * autorização (§8).
 *
 * O papel-alvo é escolhido antes da frase, e de propósito: "a Ana pode vender" não diz a QUEM se
 * aplica, e adivinhar o papel a partir de um nome próprio seria a pior classe de suposição —
 * mudaria permissão de um papel inteiro por causa de uma pessoa citada.
 *
 * Criar papel novo não passa por aqui: exige código e nome, que a frase não traz. O botão "Novo
 * papel" continua sendo o caminho, e a frase ajusta o que já existe.
 */
export function RolePhraseComposer({
  roles,
  onApplied,
}: {
  roles: Role[];
  onApplied: () => void | Promise<void>;
}) {
  const { enqueueSnackbar } = useSnackbar();

  const [roleId, setRoleId] = useState('');
  const [phrase, setPhrase] = useState('');
  const [reading, setReading] = useState<PermissionPhraseReading | null>(null);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);

  const role = roles.find((candidate) => candidate.id === roleId) ?? null;

  /*
   * ⚠️ SEM MICROFONE AQUI, por critério do Eliab (15/08/2026) — e vale mesmo no melhor resultado da
   * medição de qualidade do ditado.
   *
   * A frase desta tela é ditado corrido com negação: *"pode ver empresas MAS NÃO pode excluir
   * empresa"*. Se a transcrição perder o "não", a frase resultante é coerente, a guarda de citação
   * confirma o trecho (ele existe no texto transcrito) e o operador aprova o oposto do que disse.
   * Nenhuma camada abaixo pega isso.
   *
   * O reconhecimento local disponível em pt-BR é o nível `command`, feito para frase curta e
   * imperativa — o caso da Mesa, não o desta tela. O custo de digitar aqui não se compara ao de uma
   * permissão invertida em silêncio.
   */

  async function translate() {
    if (!role || phrase.trim().length < 3 || translating) {
      return;
    }
    setTranslating(true);
    setReading(null);
    try {
      setReading(await roleService.readPhrase(phrase.trim()));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível traduzir a frase.'), {
        variant: 'error',
      });
    } finally {
      setTranslating(false);
    }
  }

  async function apply(permissions: string[]) {
    if (!role) {
      return;
    }
    setSaving(true);
    try {
      await roleService.update(role.id, { permissions });
      enqueueSnackbar(`Permissões de ${role.name} atualizadas.`, { variant: 'success' });
      setReading(null);
      setPhrase('');
      await onApplied();
    } catch (error) {
      // A mensagem do backend é preferida: é ela que sabe dizer que a alteração deixaria a conta
      // sem ninguém capaz de administrar papéis (trava anti-lockout). Trocar por texto genérico
      // jogaria fora a única parte acionável.
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível aplicar as permissões.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Paper variant="outlined" sx={{ p: 3, bgcolor: 'vx.panel', borderColor: 'vx.accent.300' }}>
        <Typography variant="overline" component="h2">
          Descreva em português
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 620 }}>
          Escreva o que a pessoa pode e não pode fazer. Eu mostro a tradução permissão por
          permissão, com o trecho da sua frase que originou cada uma — e pergunto o que ela não
          disse.
        </Typography>

        {/*
          AVISO DE PROVEDOR EXTERNO (decisão de Eliab, 13/08/2026).

          A tradução acontece fora daqui, num provedor de IA — e quem escreve a frase tem o direito de
          saber disso ANTES de escrever, não depois. A frase pode citar nome de funcionário, o que a
          torna dado pessoal de terceiro; o desenho desta tela dispensa nomes de propósito (o papel é
          escolhido no seletor ao lado, e o exemplo do campo não usa nome nenhum), mas dispensar não é
          impedir, e o aviso é o que fecha essa diferença.

          Discreto por decisão: um alerta grande transformaria uma informação de rotina em susto, e
          susto repetido é a coisa que se aprende a fechar sem ler.
        */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          O texto que você escrever é enviado a um provedor de IA externo para ser traduzido. Não é
          preciso citar nomes de pessoas — o papel é escolhido no seletor ao lado.
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2.5 }}>
          <TextField
            select
            label="Papel"
            value={roleId}
            onChange={(event) => {
              setRoleId(event.target.value);
              setReading(null);
            }}
            sx={{ minWidth: 220 }}
            SelectProps={{ MenuProps: { disablePortal: true } }}
          >
            {roles.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !reading) {
                event.preventDefault();
                void translate();
              }
            }}
            placeholder="pode ver e cadastrar empresas, mas não pode excluir empresa"
            inputProps={{ 'aria-label': 'O que este papel pode fazer', maxLength: 1000 }}
            disabled={!role}
            helperText={
              role
                ? 'Os papéis padrão são ajustáveis — o cadeado na lista impede excluir, não editar.'
                : 'Escolha o papel primeiro: a frase não diz a quem ela se aplica.'
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {translating ? (
                    <CircularProgress size={22} role="status" aria-label="Traduzindo" />
                  ) : (
                    <IconButton
                      onClick={() => void translate()}
                      aria-label="Traduzir"
                      disabled={!role || phrase.trim().length < 3}
                    >
                      <ArrowForwardIcon />
                    </IconButton>
                  )}
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </Paper>

      {reading && role ? (
        <Box sx={{ mt: 2 }}>
          <RolePhrasePanel
            role={role}
            reading={reading}
            saving={saving}
            onApply={(permissions) => void apply(permissions)}
            onDiscard={() => setReading(null)}
          />
        </Box>
      ) : null}
    </Box>
  );
}
