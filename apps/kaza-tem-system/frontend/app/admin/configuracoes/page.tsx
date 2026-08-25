'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import adminMarketplaceService, {
  AdminMarketplaceConfig,
} from '@/services/adminMarketplaceService';

type AlertState = {
  message: string;
  severity: 'success' | 'error' | 'info';
} | null;

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<AdminMarketplaceConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [alert, setAlert] = useState<AlertState>(null);
  const [newCredentials, setNewCredentials] = useState<{
    apiKey: string;
    apiSecret: string;
  } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await adminMarketplaceService.getConfig();
      setConfig(data);
      setWebhookUrl(data.webhookUrl ?? '');
    } catch (error) {
      setAlert({ message: 'Falha ao carregar configurações', severity: 'error' });
    }
  }

  async function handleSaveWebhook() {
    try {
      await adminMarketplaceService.updateConfig({ webhookUrl });
      setAlert({ message: 'Webhook atualizado com sucesso', severity: 'success' });
      loadConfig();
    } catch (error) {
      setAlert({ message: 'Erro ao salvar webhook', severity: 'error' });
    }
  }

  async function handleTestWebhook() {
    try {
      const result = await adminMarketplaceService.testWebhook();
      if (result.success) {
        setAlert({ message: 'Webhook testado com sucesso', severity: 'success' });
      } else {
        setAlert({ message: `Teste falhou: ${result.message}`, severity: 'error' });
      }
    } catch (error) {
      setAlert({ message: 'Erro ao testar webhook', severity: 'error' });
    }
  }

  async function handleRegenerateCredentials() {
    if (!confirm('Isso irá gerar novas credenciais e invalidar as atuais. Continuar?')) {
      return;
    }

    try {
      const result = await adminMarketplaceService.regenerateCredentials();
      setNewCredentials({ apiKey: result.apiKey, apiSecret: result.apiSecret });
      setAlert({ message: 'Credenciais regeneradas. Salve-as agora.', severity: 'success' });
    } catch (error) {
      setAlert({ message: 'Erro ao regenerar credenciais', severity: 'error' });
    }
  }

  function handleCopyApiKey() {
    if (!config?.apiKey) {
      return;
    }

    navigator.clipboard.writeText(config.apiKey);
    setAlert({ message: 'API Key copiada para a área de transferência', severity: 'info' });
  }

  function maskKey(key: string) {
    if (key.length <= 12) {
      return key;
    }
    return `${key.substring(0, 6)}...${key.substring(key.length - 6)}`;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Configurações do painel</Typography>
          <Typography color="text.secondary">
            Controle os acessos ao marketplace e configure as notificações para o Magis5 ERP.
          </Typography>
        </Box>

        {alert && (
          <Alert severity={alert.severity} onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Integração com Magis5 (ERP)</Typography>
              <Typography color="text.secondary">
                O Magis5 utiliza estas credenciais para sincronizar produtos, preços, estoque e
                receber webhooks de pedidos pagos.
              </Typography>
              <Divider />

              <Stack direction="row" alignItems="center" spacing={2}>
                <Stack spacing={0.5} flex={1}>
                  <Typography variant="subtitle2">API Key</Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        backgroundColor: '#f5f5f5',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                      }}
                    >
                      {config?.apiKey ? maskKey(config.apiKey) : 'Nenhuma chave gerada'}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleCopyApiKey}
                      disabled={!config?.apiKey}
                      aria-label="Copiar API Key"
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
                <Stack flex={1} spacing={0.5}>
                  <Typography variant="subtitle2">API Secret</Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: 'monospace', backgroundColor: '#f5f5f5', p: 1, borderRadius: 1 }}
                  >
                    {config?.hasSecret ? '●●●●●●●●●●●●●●●●' : 'Não configurado'}
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction="row" alignItems="center" spacing={2}>
                <Chip
                  label={config?.lastUsedAt ? 'Conectado' : 'Nunca usado'}
                  color={config?.lastUsedAt ? 'success' : 'default'}
                />
                {config?.lastUsedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Última sincronização: {new Date(config.lastUsedAt).toLocaleString()}
                  </Typography>
                )}
              </Stack>

              <Typography variant="subtitle2">
                Total de produtos sincronizados: {config?.totalProducts ?? '—'}
              </Typography>

              <TextField
                label="URL do Webhook (Magis5)"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder="https://magis5.com/webhooks/kazatem/orders"
                fullWidth
                helperText="O Magis5 receberá notificações de pedidos pagos nesta URL."
              />

              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button variant="contained" onClick={handleSaveWebhook} disabled={!config}>
                  Salvar configurações
                </Button>
                <Button variant="outlined" onClick={handleTestWebhook} disabled={!webhookUrl}>
                  Testar webhook
                </Button>
                <Button variant="outlined" color="error" onClick={handleRegenerateCredentials}>
                  Regenerar credenciais
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Dialog open={!!newCredentials} onClose={() => setNewCredentials(null)}>
          <DialogTitle>Novas credenciais geradas</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Alert severity="warning">
                Salve estas credenciais agora. Elas não serão exibidas novamente.
              </Alert>
              <TextField
                label="API Key"
                value={newCredentials?.apiKey ?? ''}
                InputProps={{ readOnly: true }}
                fullWidth
              />
              <TextField
                label="API Secret"
                value={newCredentials?.apiSecret ?? ''}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewCredentials(null)}>Fechar</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}
