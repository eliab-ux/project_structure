'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { CompanyFormDialog } from 'src/components/CompanyFormDialog';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import companyService from 'src/services/companyService';
import { apiErrorMessage } from 'src/services/api';
import { Company, CreateCompanyPayload, TAX_REGIME_LABEL } from 'src/types/admin';

/** Largura das telas de administração — a mesma nas quatro, para a troca entre elas não deslocar a página. */
const ADMIN_MAX_WIDTH = 1200;

/**
 * Empresas da conta (01_Veertex_Core §3.2).
 *
 * Empresa é desativada, nunca excluída: documento fiscal a referencia por anos, e a linha precisa
 * continuar legível. Por isso a coluna de ação tem um interruptor de status e não uma lixeira.
 *
 * As ações são escondidas por permissão, e isso é conveniência de interface — não segurança. Quem
 * decide é o `PermissionGuard` no backend; esconder o botão só evita oferecer ao usuário uma ação
 * que terminaria em 403.
 */
export default function CompaniesPage() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCompanies(await companyService.list(includeInactive));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as empresas.'));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(payload: CreateCompanyPayload) {
    setSaving(true);
    try {
      if (editing) {
        // O documento não vai no update: o backend não aceita trocá-lo, e mandá-lo faria o
        // `forbidNonWhitelisted` do ValidationPipe recusar a requisição inteira.
        const { document, ...rest } = payload;
        void document;
        await companyService.update(editing.id, rest);
        enqueueSnackbar('Empresa atualizada.', { variant: 'success' });
      } else {
        await companyService.create(payload);
        enqueueSnackbar('Empresa cadastrada.', { variant: 'success' });
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (requestError) {
      // A mensagem do backend é preferida: ela sabe dizer "seu plano permite no máximo 3 empresas",
      // e trocar isso por um texto genérico jogaria fora a única parte útil.
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(company: Company) {
    try {
      await companyService.setActive(company.id, !company.active);
      enqueueSnackbar(company.active ? 'Empresa desativada.' : 'Empresa reativada.', {
        variant: 'success',
      });
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  const state = (
    <DataState
      loading={loading}
      error={error}
      empty={companies.length === 0}
      emptyMessage={
        includeInactive
          ? 'Nenhuma empresa cadastrada.'
          : 'Nenhuma empresa ativa. Marque "incluir inativas" para ver as desativadas.'
      }
    />
  );

  return (
    <Box component="section" aria-label="Empresas" sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto' }}>
      <PageHeader
        title="Empresas"
        description="As empresas (CNPJs) que operam sob esta conta."
        action={
          can('companies.create') ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              Nova empresa
            </Button>
          ) : null
        }
      />

      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Switch
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
        }
        label="Incluir inativas"
      />

      {state ?? (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de empresas">
            <TableHead>
              <TableRow>
                <TableCell>Empresa</TableCell>
                <TableCell>CNPJ</TableCell>
                <TableCell>Regime</TableCell>
                <TableCell>Cidade/UF</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {company.displayName}
                    </Typography>
                    {company.tradeName ? (
                      <Typography variant="caption" color="text.secondary">
                        {company.legalName}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{company.documentFormatted}</TableCell>
                  <TableCell>{TAX_REGIME_LABEL[company.taxRegime] ?? company.taxRegime}</TableCell>
                  <TableCell>
                    {company.address.city}/{company.address.state}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={company.active ? 'Ativa' : 'Inativa'}
                      color={company.active ? 'success' : 'default'}
                      variant={company.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {can('companies.update') ? (
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            aria-label={`Editar ${company.displayName}`}
                            onClick={() => {
                              setEditing(company);
                              setDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}

                      {can('companies.delete') ? (
                        <Tooltip title={company.active ? 'Desativar' : 'Reativar'}>
                          <Switch
                            size="small"
                            checked={company.active}
                            onChange={() => void handleToggleActive(company)}
                            inputProps={{
                              'aria-label': `${company.active ? 'Desativar' : 'Reativar'} ${company.displayName}`,
                            }}
                          />
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CompanyFormDialog
        open={dialogOpen}
        company={editing}
        saving={saving}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
