'use client';

import {
  Badge,
  Box,
  Button,
  Chip,
  Container,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

const pendingResellers = [
  {
    id: 'R-001',
    fullName: 'Camila Santos',
    cpf: '123.456.789-00',
    email: 'camila@exemplo.com',
    phone: '(11) 99999-0011',
    createdAt: '2026-02-18T10:34:00Z',
    bankName: 'Banco do Brasil',
    agency: '0123-4',
    account: '56789-0',
  },
  {
    id: 'R-002',
    fullName: 'Thiago Oliveira',
    cpf: '987.654.321-00',
    email: 'thiago@exemplo.com',
    phone: '(21) 98888-2222',
    createdAt: '2026-02-19T08:12:00Z',
    bankName: 'Caixa',
    agency: '4321-0',
    account: '12345-6',
  },
];

const checklist = [
  { label: 'GET /api/admin/resellers/pending', status: 'todo' },
  { label: 'Modal com dados pessoais e bancários', status: 'todo' },
  { label: 'Aprovar gera código único e notifica o revendedor', status: 'todo' },
  { label: 'Rejeitar exige motivo e envia email', status: 'todo' },
];

const pendingCount = pendingResellers.length;

export default function AdminPendingResellersPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Cadastros Pendentes de Aprovação</Typography>
          <Typography color="text.secondary">
            Enquanto existirem cadastros pendentes, os administradores devem conferir dados pessoais
            e bancários.
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack spacing={1}>
              <Typography variant="h6">Resumo</Typography>
              <Typography variant="body2" color="text.secondary">
                Os cadastros abaixo estão aguardando análise detalhada com os dados bancários
                completos.
              </Typography>
            </Stack>
            <Badge badgeContent={pendingCount} color="error">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {pendingCount} pendente(s)
              </Typography>
            </Badge>
          </Stack>
        </Paper>

        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>CPF</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell>Cadastro</TableCell>
                <TableCell>Banco</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingResellers.map((reseller) => (
                <TableRow key={reseller.id}>
                  <TableCell>{reseller.fullName}</TableCell>
                  <TableCell>{reseller.cpf}</TableCell>
                  <TableCell>{reseller.email}</TableCell>
                  <TableCell>{reseller.phone}</TableCell>
                  <TableCell>
                    {new Date(reseller.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    {reseller.bankName} · Ag {reseller.agency} · Cc {reseller.account}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<HourglassEmptyIcon />}
                    >
                      Analisar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Checklist rápido
          </Typography>
          <List>
            {checklist.map((item) => (
              <ListItem key={item.label} disableGutters>
                <ListItemIcon>
                  <CheckCircleOutlineIcon color={item.status === 'todo' ? 'disabled' : 'success'} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.status === 'todo' ? 'Não implementado ainda' : 'Pronto'}
                />
              </ListItem>
            ))}
          </List>
          <Box sx={{ mt: 2 }}>
            <Chip label="Implementação em andamento" color="warning" />
          </Box>
        </Paper>
      </Stack>
    </Container>
  );
}
