'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LockIcon from '@mui/icons-material/Lock';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import moduleService from 'src/services/moduleService';
import { AccountModule } from 'src/types/auth';

/**
 * MÓDULOS (§5.2) — ligar e desligar o que a conta usa.
 *
 * Quatro comportamentos são requisito, e cada um responde a uma forma específica de errar:
 *
 * **1. CORE não é desativável.** Não é uma regra de tela: o backend recusa, e aqui o toggle nem
 * existe — no lugar dele vai um cadeado. Um switch que o servidor sempre recusa é uma promessa
 * falsa, e o usuário aprende a desconfiar de todos os outros.
 *
 * **2. O impedimento aparece ANTES do clique, nomeando quem depende.** O `ModuleDto` já traz
 * `blockingDependents` e `missingDependencies` calculados pelo servidor — a tela não deduz nada.
 * Desabilitar o toggle sem dizer o motivo seria pior que deixá-lo clicável: o usuário fica sem ação
 * e sem explicação. Nunca há cascata: desligar FIN **não** desliga COB junto. Cascata silenciosa
 * derruba num clique um módulo que o cliente estava usando.
 *
 * **3. A confirmação diz o que acontece com os dados.** "Desativar" soa como "apagar" para quem
 * administra a conta, e o medo de perder dado é o que faz alguém não mexer em nada. Os dados ficam
 * intactos e voltam na reativação — isso é dito na confirmação, não no rodapé de uma ajuda.
 *
 * **4. A propagação leva até 15 minutos, e a tela não finge o contrário.** Os módulos efetivos
 * viajam no ACCESS TOKEN (ADR-0001). Para quem executou, renovamos a sessão na hora — o menu muda
 * imediatamente. Para os OUTROS usuários logados, o token velho continua valendo até expirar. A
 * tela avisa disso depois de cada mudança; sem o aviso, um administrador vê o colega continuar
 * enxergando o módulo e conclui que o sistema está quebrado.
 */
export default function ModulesPage() {
  const { can, refreshSession } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [modules, setModules] = useState<AccountModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AccountModule | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastChange, setLastChange] = useState<{ code: string; active: boolean } | null>(null);

  // Esconder não é proteger: quem não tem `account.update` continua VENDO a configuração (o
  // backend exige só `account.read` para listar), mas os controles ficam inertes e explicados.
  const canToggle = can('account.update');

  const load = useCallback(async () => {
    setError(null);
    try {
      setModules(await moduleService.list());
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os módulos.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** CORE primeiro, depois os ativos, depois o resto — o mesmo critério da Mesa. */
  const ordered = useMemo(() => {
    if (!modules) {
      return [];
    }
    return [...modules].sort((a, b) => {
      if (a.core !== b.core) return a.core ? -1 : 1;
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.code.localeCompare(b.code);
    });
  }, [modules]);

  async function confirmToggle() {
    if (!pending) {
      return;
    }
    const target = pending;
    setSaving(true);
    try {
      const result = await moduleService.toggle(target.code, !target.active);

      // O token carrega os módulos: sem renovar, quem acabou de ligar o módulo continuaria sem ele
      // no próprio menu. `requiresTokenRefresh` vem do backend — não presumimos que sempre precisa.
      if (result.requiresTokenRefresh) {
        await refreshSession();
      }

      // Recarrega a lista inteira em vez de alterar o item na mão: ligar um módulo muda
      // `blockingDependents` e `missingDependencies` de OUTROS, e recalcular isso no cliente seria
      // duplicar a regra que o servidor já aplica — a segunda cópia divergiria na primeira mudança.
      await load();

      setLastChange({ code: target.code, active: result.active });
      enqueueSnackbar(result.active ? `${target.code} ativado.` : `${target.code} desativado.`, {
        variant: 'success',
      });
      setPending(null);
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError, 'Não foi possível alterar o módulo.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <PageHeader
        title="Módulos"
        description="O que esta conta usa. Ligar e desligar não apaga nada."
      />

      {!canToggle ? (
        <Alert severity="info" role="status" sx={{ mb: 3 }}>
          Você pode ver esta configuração, mas não alterá-la. Alterar módulos exige a permissão{' '}
          <strong>account.update</strong>.
        </Alert>
      ) : null}

      {lastChange ? (
        <Alert severity="info" role="status" sx={{ mb: 3 }} onClose={() => setLastChange(null)}>
          <strong>
            {lastChange.code} {lastChange.active ? 'ativado' : 'desativado'} para você agora.
          </strong>{' '}
          Para os outros usuários já conectados, a mudança aparece quando a sessão deles renovar —
          pode levar até 15 minutos. Ninguém precisa sair e entrar de novo.
        </Alert>
      ) : null}

      <DataState
        loading={modules === null}
        error={error}
        empty={modules !== null && ordered.length === 0}
        emptyMessage="Nenhum módulo no catálogo."
      />

      {ordered.length > 0 && !error ? (
        <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {ordered.map((module) => (
            <ModuleRow
              key={module.code}
              module={module}
              canToggle={canToggle}
              onRequestToggle={() => setPending(module)}
            />
          ))}
        </Stack>
      ) : null}

      <ConfirmToggleDialog
        module={pending}
        saving={saving}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmToggle()}
      />
    </Box>
  );
}

/**
 * Por que o motivo do bloqueio é calculado aqui e não no clique: o §5.2 exige que o impedimento
 * apareça ANTES da tentativa. Todos os dados vêm do servidor; esta função só escolhe a frase.
 */
function blockReason(module: AccountModule): string | null {
  if (module.core) {
    return 'O CORE é a base do sistema — cadastros, usuários e papéis. Ele não se desliga.';
  }
  if (!module.availableInPlan) {
    return 'Este módulo não faz parte do plano desta conta.';
  }
  if (module.active && module.blockingDependents.length > 0) {
    const dependents = module.blockingDependents.join(', ');
    const verb = module.blockingDependents.length === 1 ? 'depende' : 'dependem';
    return `Não é possível desativar ${module.code}: ${dependents} ${verb} dele. Desative ${dependents} primeiro.`;
  }
  if (!module.active && module.missingDependencies.length > 0) {
    const missing = module.missingDependencies.join(', ');
    const verb = module.missingDependencies.length === 1 ? 'está inativo' : 'estão inativos';
    return `${module.code} precisa de ${missing}, que ${verb}. Ative ${missing} primeiro.`;
  }
  return null;
}

function ModuleRow({
  module,
  canToggle,
  onRequestToggle,
}: {
  module: AccountModule;
  canToggle: boolean;
  onRequestToggle: () => void;
}) {
  const reason = blockReason(module);
  const blocked = reason !== null;

  return (
    <Paper
      component="li"
      variant="outlined"
      sx={{
        p: 2.5,
        bgcolor: module.active ? 'vx.panel' : 'transparent',
        // Opacidade sozinha não comunica: a borda muda junto, e o motivo aparece por escrito.
        borderColor: module.active ? 'vx.accent.300' : 'vx.neutral.400',
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h2" component="h2" sx={{ fontSize: '1rem' }}>
              {module.code}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {module.name}
            </Typography>
            {module.core ? (
              <Chip size="small" label="sempre ativo" color="secondary" />
            ) : (
              <Chip
                size="small"
                variant="outlined"
                label={module.active ? 'ativo' : 'inativo'}
                // Estado também em texto, nunca só em cor.
                color={module.active ? 'success' : 'default'}
              />
            )}
            {!module.availableInPlan && !module.core ? (
              <Chip size="small" variant="outlined" label="fora do plano" />
            ) : null}
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {module.description}
          </Typography>

          {module.dependsOn.length > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Depende de: {module.dependsOn.join(', ')}
            </Typography>
          ) : null}

          {reason ? (
            <Typography
              variant="body2"
              role="note"
              sx={{ mt: 1.25, color: 'vx.warn', fontWeight: 600 }}
            >
              {reason}
            </Typography>
          ) : null}
        </Box>

        <Box sx={{ pt: 0.5 }}>
          {module.core ? (
            // Cadeado no lugar do switch: o CORE não é "um switch travado", é uma coisa que não
            // tem switch. A distinção evita a leitura de "está quebrado".
            <Tooltip title="A base do sistema não se desliga">
              <LockIcon
                fontSize="small"
                sx={{ color: 'vx.neutral.500' }}
                aria-label="Sempre ativo"
              />
            </Tooltip>
          ) : (
            <Switch
              checked={module.active}
              onChange={onRequestToggle}
              disabled={blocked || !canToggle}
              inputProps={{
                'aria-label': `${module.active ? 'Desativar' : 'Ativar'} ${module.code}`,
              }}
            />
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

/**
 * A confirmação. O texto sobre os dados é o ponto dela — sem isso, "desativar" é lido como "apagar",
 * e quem administra a conta simplesmente não mexe.
 */
function ConfirmToggleDialog({
  module,
  saving,
  onCancel,
  onConfirm,
}: {
  module: AccountModule | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const deactivating = module?.active === true;

  return (
    <Dialog open={module !== null} onClose={saving ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        {deactivating ? `Desativar ${module?.code}?` : `Ativar ${module?.code}?`}
      </DialogTitle>
      <DialogContent>
        {deactivating ? (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Os dados ficam intactos.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Nada é apagado. As telas e as ações de {module?.code} deixam de aparecer, e tudo o que
              já foi registrado volta exatamente como está se você reativar o módulo depois.
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            As telas e as ações de {module?.code} passam a ficar disponíveis para quem tiver
            permissão. Se o módulo já foi usado antes, os dados de então voltam a aparecer.
          </Typography>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          A mudança vale para você imediatamente. Para os outros usuários já conectados, pode levar
          até 15 minutos.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" color="secondary" onClick={onConfirm} disabled={saving}>
          {saving ? 'Aplicando…' : deactivating ? 'Desativar' : 'Ativar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
