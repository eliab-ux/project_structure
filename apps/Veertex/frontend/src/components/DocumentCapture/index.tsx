'use client';

import { useCallback, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';

/** O anexo pronto para viajar no corpo da requisição. Nunca vai para disco. */
export interface CapturedImage {
  mimeType: string;
  dataBase64: string;
  /** Só para a prévia na tela — revogado ao remover. */
  previewUrl: string;
  bytes: number;
  /** Quando o aviso ao titular foi exibido. O backend RECUSA a imagem sem isto. */
  noticeAcknowledgedAt: string;
}

const LADO_MAXIMO = 1600;
const QUALIDADE = 0.8;

/**
 * CAPTURA DE DOCUMENTO — foto ou arquivo, para o tradutor ler e preencher o rascunho.
 *
 * ## O aviso vem ANTES de a câmera abrir, e não é decoração
 *
 * A pessoa fotografada não é parte de contrato nenhum: o contrato existe entre o Veertex e a conta, e
 * o titular do documento não assinou nada nem sabe que a foto dele vai a um provedor externo. Nenhum
 * termo com o provedor resolve isso — o problema é anterior a ele.
 *
 * O que o aviso faz é dividir o que dá para dividir: **o Veertex informa, o operador obtém o
 * consentimento**. Ele diz três coisas, e as três são verdadeiras: a imagem é enviada para leitura,
 * não fica armazenada, e o consentimento é responsabilidade de quem fotografa.
 *
 * **Antes da câmera, não depois.** Aviso posterior é informação sobre algo que já aconteceu — a foto
 * já teria sido tirada, e a pessoa já teria sido fotografada sem que ninguém lhe dissesse nada.
 *
 * A exibição é REGISTRADA: o horário viaja com a requisição e o backend recusa sem ele. Não é
 * telemetria — é o que impede uma refatoração de tela de remover o aviso sem ninguém notar.
 *
 * ## A imagem é comprimida no cliente
 *
 * Foto de celular tem 4 MB; o que o modelo precisa para ler um documento cabe em ~300 KB. Comprimir
 * aqui reduz o que trafega, o que é cobrado por token, e o tempo que o operador espera. O limite da
 * rota (8 MB de base64) é teto de abuso, não de uso.
 */
export function DocumentCapture({
  image,
  onCapture,
  onRemove,
  disabled,
}: {
  image: CapturedImage | null;
  onCapture: (image: CapturedImage) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [avisoAberto, setAvisoAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  /** Preenchido ao aceitar o aviso; o input só é acionado depois disso. */
  const avisoEm = useRef<string | null>(null);

  const comprimir = useCallback(async (file: File): Promise<CapturedImage> => {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('sem canvas');
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (resultado) => (resultado ? resolve(resultado) : reject(new Error('falhou'))),
        'image/jpeg',
        QUALIDADE,
      );
    });

    const buffer = await blob.arrayBuffer();
    let binario = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binario += String.fromCharCode(bytes[i]);
    }

    return {
      mimeType: 'image/jpeg',
      dataBase64: btoa(binario),
      previewUrl: URL.createObjectURL(blob),
      bytes: blob.size,
      noticeAcknowledgedAt: avisoEm.current ?? new Date().toISOString(),
    };
  }, []);

  async function aoEscolher(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Zera o input: escolher o MESMO arquivo duas vezes seguidas não dispara `change` sem isto.
    event.target.value = '';
    if (!file) {
      return;
    }
    setErro(null);
    try {
      onCapture(await comprimir(file));
    } catch {
      setErro('Não consegui preparar essa imagem. Tente outra foto.');
    }
  }

  function aceitarAviso(origem: 'camera' | 'arquivo') {
    avisoEm.current = new Date().toISOString();
    setAvisoAberto(false);
    // O input só é acionado DEPOIS do aceite — é isso que põe o aviso antes da câmera.
    (origem === 'camera' ? cameraRef : arquivoRef).current?.click();
  }

  if (image) {
    return (
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          border: '1px solid',
          borderColor: 'vx.warn',
          borderRadius: 1,
          bgcolor: 'vx.panel',
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt="Prévia do documento a enviar"
            style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 4 }}
          />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Imagem pronta para leitura · {Math.round(image.bytes / 1024)} KB
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Ela é enviada para leitura e <strong>não fica armazenada</strong>. Os campos lidos
              chegam marcados como fonte externa, para você conferir.
            </Typography>
          </Box>
          <Tooltip title="Remover a imagem">
            <IconButton onClick={onRemove} aria-label="Remover a imagem" disabled={disabled}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    );
  }

  return (
    <>
      <Tooltip title="Anexar documento (foto ou arquivo)">
        <Box component="span" sx={{ display: 'inline-flex' }}>
          <IconButton
            onClick={() => setAvisoAberto(true)}
            aria-label="Anexar documento"
            disabled={disabled}
            sx={{ color: 'text.secondary' }}
          >
            <AttachFileIcon fontSize="small" />
          </IconButton>
        </Box>
      </Tooltip>

      {/* capture="environment" abre a câmera traseira no celular; no desktop cai no seletor. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => void aoEscolher(event)}
        style={{ display: 'none' }}
      />
      <input
        ref={arquivoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void aoEscolher(event)}
        style={{ display: 'none' }}
      />

      <Dialog open={avisoAberto} onClose={() => setAvisoAberto(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Antes de fotografar</DialogTitle>
        <DialogContent>
          <Alert severity="warning" role="status" sx={{ mb: 2 }}>
            A imagem é <strong>enviada a um provedor de IA externo</strong> para ser lida.
          </Alert>

          <Typography variant="body2" component="div">
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              <li>
                A imagem é processada para extrair os campos e <strong>descartada</strong> — o
                Veertex não a armazena.
              </li>
              <li>
                Os campos lidos entram como <strong>rascunho para você conferir</strong>, marcados
                como fonte externa. Nada é gravado sem a sua aprovação.
              </li>
              <li>
                <strong>
                  Obter o consentimento do titular do documento é responsabilidade de quem
                  fotografa.
                </strong>{' '}
                O documento é dele, não da sua conta.
              </li>
            </ul>
          </Typography>

          {erro ? (
            <Alert severity="error" role="alert" sx={{ mt: 2 }}>
              {erro}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAvisoAberto(false)}>Cancelar</Button>
          <Button startIcon={<InsertPhotoOutlinedIcon />} onClick={() => aceitarAviso('arquivo')}>
            Escolher arquivo
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PhotoCameraIcon />}
            onClick={() => aceitarAviso('camera')}
          >
            Entendi — abrir a câmera
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
