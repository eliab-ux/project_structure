'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSnackbar } from 'notistack';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SpeedIcon from '@mui/icons-material/Speed';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PaletteIcon from '@mui/icons-material/Palette';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import { useEmdrSocket } from 'src/hooks/useEmdrSocket';
import { useEmdrAudio } from 'src/emdr/useEmdrAudio';
import { useLocalMedia } from 'src/emdr/useLocalMedia';
import { useWebRtc } from 'src/emdr/useWebRtc';
import { MOVEMENTS, MOVEMENT_COUNTS, MUSICS, TONES } from 'src/emdr/sounds';
import sessionService from 'src/services/sessionService';
import {
  AudioAction,
  AudioCategory,
  BallAction,
  ChatMessage,
  MovementType,
  MuteTarget,
  Role,
  SessionInfo,
} from 'src/types';

const MARGIN = 0.1;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function EmdrRoomPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const code = params?.code ?? '';
  const role: Role = searchParams.get('role') === 'psicologo' ? 'psicologo' : 'paciente';
  const isPsi = role === 'psicologo';

  // Estímulo (psicólogo controla; paciente espelha)
  const [running, setRunning] = useState(false);
  const [movement, setMovement] = useState<MovementType>('horizontal');
  const [speed, setSpeed] = useState(8);
  const [color, setColor] = useState('#4FA3A4');
  const [size, setSize] = useState(28);
  const [maxMovements, setMaxMovements] = useState(0);
  const [movesLeft, setMovesLeft] = useState(0);
  // Ocultar a bola SÓ na tela do psicólogo (local; não sincroniza — paciente continua vendo).
  const [showBallLocal, setShowBallLocal] = useState(true);

  // Áudio
  const [category, setCategory] = useState<AudioCategory>('tone');
  const [track, setTrack] = useState('');
  const [volume, setVolume] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [muteTarget, setMuteTarget] = useState<MuteTarget>('none');

  // UI
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [soundAnchor, setSoundAnchor] = useState<HTMLElement | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [floatPos, setFloatPos] = useState({ x: 24, y: 80 });
  const [info, setInfo] = useState<SessionInfo | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerVideoRef = useRef<HTMLVideoElement | null>(null);
  const phaseRef = useRef(0);
  const dirRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const movesDoneRef = useRef(0);

  const audio = useEmdrAudio();
  const media = useLocalMedia();
  const { socket, joined, peerOnline, emitBall, emitAudio, sendMessage, endCall } = useEmdrSocket({
    sessionCode: code,
    onBall: useCallback((a: BallAction) => {
      if (a.running !== undefined) {
        if (a.running) {
          phaseRef.current = 0;
          dirRef.current = 1;
          movesDoneRef.current = 0;
        }
        setRunning(a.running);
      }
      if (a.movement !== undefined) setMovement(a.movement);
      if (a.speed !== undefined) setSpeed(a.speed);
      if (a.color !== undefined) setColor(a.color);
      if (a.size !== undefined) setSize(a.size);
      if (a.maxMovements !== undefined) setMaxMovements(a.maxMovements);
      if (a.reset) {
        phaseRef.current = 0;
        dirRef.current = 1;
        movesDoneRef.current = 0;
        setRunning(false);
      }
    }, []),
    onAudio: useCallback((a: AudioAction) => {
      if (a.category !== undefined) setCategory(a.category);
      if (a.track !== undefined) setTrack(a.track);
      if (a.volume !== undefined) setVolume(a.volume);
      if (a.playing !== undefined) setPlaying(a.playing);
      if (a.muteTarget !== undefined) setMuteTarget(a.muteTarget);
    }, []),
    onMessage: useCallback((m: ChatMessage) => setMessages((p) => [...p, m]), []),
    onEndCall: useCallback(() => router.replace('/chamada-encerrada'), [router]),
  });

  const { remoteStream } = useWebRtc({ socket, joined, localStream, isInitiator: isPsi });

  const paramsRef = useRef({ running, movement, speed, color, size, maxMovements, playing });
  paramsRef.current = { running, movement, speed, color, size, maxMovements, playing };

  const pushBall = useCallback(
    (patch: BallAction) => {
      if (isPsi) emitBall(patch);
    },
    [isPsi, emitBall],
  );
  const pushAudio = useCallback(
    (patch: AudioAction) => {
      if (isPsi) emitAudio(patch);
    },
    [isPsi, emitAudio],
  );

  // Nomes dos participantes (telas de espera / presença)
  useEffect(() => {
    if (!code) return;
    sessionService
      .getByCode(code)
      .then(setInfo)
      .catch(() => undefined);
  }, [code]);

  // Câmera/mic + timer
  useEffect(() => {
    void media.start().then((stream) => {
      if (stream) {
        setLocalStream(stream);
        if (selfVideoRef.current) selfVideoRef.current.srcObject = stream;
      }
    });
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vídeo do outro participante (WebRTC)
  useEffect(() => {
    if (peerVideoRef.current) peerVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Desbloqueia o áudio no primeiro gesto (autoplay policy) — vale para paciente e psicólogo.
  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Áudio reativo
  useEffect(() => {
    if (track) audio.load(track);
  }, [track, audio]);
  useEffect(() => {
    audio.setVolume(volume / 100);
  }, [volume, audio]);
  useEffect(() => {
    audio.setMuted(muteTarget === 'ambos' || muteTarget === role);
  }, [muteTarget, role, audio]);
  useEffect(() => {
    if (playing && track) void audio.play();
    else audio.pause();
  }, [playing, track, audio]);

  // Redimensiona o canvas quando muda o modo (fullscreen/flutuante) ou a janela
  const ballMode: 'fullscreen' | 'floating' | 'hidden' = !running
    ? 'hidden'
    : isPsi
      ? showBallLocal
        ? 'floating'
        : 'hidden'
      : 'fullscreen';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [ballMode]);

  // Laço de animação. A física da bola e o PAN do som são calculados SEMPRE que está rodando
  // (independente do canvas estar montado) — assim o movimento bilateral do som é sincronizado
  // para os dois lados, mesmo com a bola oculta na tela do psicólogo.
  useEffect(() => {
    let prev = 0;
    const tick = (ts: number) => {
      const dt = prev ? (ts - prev) / 1000 : 0;
      prev = ts;
      const p = paramsRef.current;
      let nx = 0.5;
      let ny = 0.5;

      if (p.running) {
        const delta = dirRef.current * p.speed * 0.12 * dt;
        let t = phaseRef.current + delta;
        if (t >= 1) {
          t = 1;
          dirRef.current = -1;
          movesDoneRef.current += 1;
        } else if (t <= 0) {
          t = 0;
          dirRef.current = 1;
          movesDoneRef.current += 1;
        }
        phaseRef.current = t;
        if (p.maxMovements > 0) {
          setMovesLeft(Math.max(0, p.maxMovements - movesDoneRef.current));
          if (movesDoneRef.current >= p.maxMovements) {
            setRunning(false);
            if (isPsi) emitBall({ running: false });
          }
        }
        if (p.movement === 'horizontal') nx = lerp(MARGIN, 1 - MARGIN, t);
        else if (p.movement === 'vertical') ny = lerp(MARGIN, 1 - MARGIN, t);
        else if (p.movement === 'diagonal1') {
          nx = lerp(MARGIN, 1 - MARGIN, t);
          ny = lerp(MARGIN, 1 - MARGIN, t);
        } else if (p.movement === 'diagonal2') {
          nx = lerp(1 - MARGIN, MARGIN, t);
          ny = lerp(MARGIN, 1 - MARGIN, t);
        } else if (p.movement === 'sacadico') {
          nx = t < 0.5 ? MARGIN : 1 - MARGIN;
        }

        // Movimento bilateral do som acompanha a posição horizontal da bola.
        if (p.playing) audio.setPan(nx * 2 - 1);
      }

      // Desenho (só se houver canvas montado — fullscreen no paciente / flutuante no psicólogo).
      const canvas = canvasRef.current;
      if (canvas && canvas.width > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (p.running) {
            ctx.beginPath();
            ctx.arc(nx * canvas.width, ny * canvas.height, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 26;
            ctx.fill();
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers de controle (psicólogo)
  const toggleRun = () => {
    const next = !running;
    if (next) {
      phaseRef.current = 0;
      dirRef.current = 1;
      movesDoneRef.current = 0;
      setMovesLeft(maxMovements);
    }
    setRunning(next);
    pushBall({ running: next });
  };
  const stopBall = () => {
    phaseRef.current = 0;
    dirRef.current = 1;
    movesDoneRef.current = 0;
    setRunning(false);
    pushBall({ running: false, reset: true });
  };
  const changeSpeed = (v: number) => {
    setSpeed(v);
    pushBall({ speed: v });
  };
  const changeMovement = (m: MovementType) => {
    setMovement(m);
    pushBall({ movement: m });
  };
  const changeColor = (c: string) => {
    setColor(c);
    pushBall({ color: c });
  };
  const changeSize = (s: number) => {
    setSize(s);
    pushBall({ size: s });
  };
  const changeMax = (m: number) => {
    setMaxMovements(m);
    setMovesLeft(m);
    movesDoneRef.current = 0;
    pushBall({ maxMovements: m });
  };

  const changeCategory = (c: AudioCategory) => {
    setCategory(c);
    setTrack('');
    pushAudio({ category: c, track: '' });
  };
  const changeTrack = (src: string) => {
    setTrack(src);
    pushAudio({ track: src });
  };
  const toggleSound = () => {
    const p = !playing;
    setPlaying(p);
    pushAudio({ playing: p });
  };
  const changeVolume = (v: number) => {
    setVolume(v);
    pushAudio({ volume: v });
  };
  const changeMute = (m: MuteTarget) => {
    setMuteTarget(m);
    pushAudio({ muteTarget: m });
  };

  const openInvite = async () => {
    try {
      const { hash } = await sessionService.getInvite(code);
      setInviteUrl(`${window.location.origin}/sessao/${hash}?code=${code}`);
    } catch {
      enqueueSnackbar('Não foi possível gerar o convite.', { variant: 'error' });
    }
  };
  const sendInvite = async (channel: 'whatsapp' | 'email') => {
    if (!info) return;
    try {
      await sessionService.sendLink(info.pacienteId, channel);
      enqueueSnackbar(
        channel === 'whatsapp' ? 'Link enviado por WhatsApp.' : 'Link enviado por e-mail.',
        { variant: 'success' },
      );
      setInviteUrl(null);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao enviar o link.';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };
  const goFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };
  const submitMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendMessage(text);
    setMessages((p) => [...p, { text, from: role, at: new Date().toISOString() }]);
    setChatInput('');
  };
  const finish = () => {
    if (isPsi) void sessionService.end(code).catch(() => undefined);
    endCall();
    router.replace('/chamada-encerrada');
  };

  // Arrastar a janela flutuante da bola (psicólogo)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const onFloatPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - floatPos.x, dy: e.clientY - floatPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onFloatPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current)
      setFloatPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
  };
  const onFloatPointerUp = () => {
    dragRef.current = null;
  };

  // Para o paciente, o vídeo do outro some durante o movimento (foca no estímulo).
  const showPeerVideo = isPsi || !running;
  const showSelf = !(role === 'paciente' && running);
  const peerName = isPsi
    ? (info?.pacienteNome ?? 'o paciente')
    : (info?.psicologoNome ?? 'o psicólogo');
  const trackList = category === 'tone' ? TONES : MUSICS;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <Box
      component="main"
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0b1414',
      }}
    >
      {/* Barra superior */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1, color: 'common.white', bgcolor: 'rgba(0,0,0,0.4)', zIndex: 10 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Sessão EMDR
        </Typography>
        <Chip
          size="small"
          label={`⏱ ${mm}:${ss}`}
          sx={{ color: 'common.white', bgcolor: 'rgba(255,255,255,0.12)' }}
        />
        <Chip size="small" label={isPsi ? 'Psicólogo' : 'Paciente'} color="primary" />
        <Tooltip title="Código da sala — os dois participantes precisam do mesmo">
          <Chip
            size="small"
            label={`sala ${code}`}
            sx={{ color: 'common.white', bgcolor: 'rgba(255,255,255,0.12)' }}
          />
        </Tooltip>
        {peerOnline && (
          <Chip
            size="small"
            color="success"
            label={`🟢 ${peerName} online`}
            sx={{ fontWeight: 700 }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Chat">
          <IconButton sx={{ color: 'common.white' }} onClick={() => setChatOpen(true)}>
            <ChatIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Tela cheia">
          <IconButton sx={{ color: 'common.white' }} onClick={goFullscreen}>
            <FullscreenIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Palco */}
      <Box sx={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Vídeo do outro participante (tela cheia) */}
        <video
          ref={peerVideoRef}
          autoPlay
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: showPeerVideo && remoteStream ? 'block' : 'none',
          }}
        />
        {showPeerVideo && !remoteStream && (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ position: 'absolute', inset: 0, color: 'grey.400' }}
          >
            <CircularProgress color="inherit" />
            <Typography variant="body2">
              {peerOnline ? 'Conectando vídeo…' : `Aguardando ${peerName} entrar…`}
            </Typography>
          </Stack>
        )}

        {/* Quadro de presença (psicólogo): paciente já está online na sala */}
        {isPsi && peerOnline && (
          <Paper
            elevation={4}
            sx={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              px: 2,
              py: 0.75,
              borderRadius: 999,
              bgcolor: 'success.main',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              zIndex: 8,
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#fff' }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {info?.pacienteNome ?? 'Paciente'} está online
            </Typography>
          </Paper>
        )}

        {/* Bola em tela cheia (paciente, durante o movimento) */}
        {ballMode === 'fullscreen' && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#0b1414', zIndex: 5 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          </Box>
        )}

        {/* Bola em janela flutuante (psicólogo) */}
        {ballMode === 'floating' && (
          <Paper
            elevation={8}
            onPointerDown={onFloatPointerDown}
            onPointerMove={onFloatPointerMove}
            onPointerUp={onFloatPointerUp}
            sx={{
              position: 'absolute',
              left: floatPos.x,
              top: floatPos.y,
              width: 360,
              height: 210,
              overflow: 'hidden',
              borderRadius: 2,
              bgcolor: '#0b1414',
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'move',
              zIndex: 6,
            }}
          >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            <Chip
              size="small"
              label="Estímulo (paciente)"
              sx={{
                position: 'absolute',
                top: 6,
                left: 6,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.5)',
              }}
            />
          </Paper>
        )}

        {/* Self-view (minha câmera) */}
        {showSelf && (
          <Paper
            elevation={6}
            sx={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 168,
              height: 112,
              overflow: 'hidden',
              borderRadius: 2,
              bgcolor: '#000',
              zIndex: 7,
            }}
          >
            <video
              ref={selfVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {media.error && (
              <Typography
                variant="caption"
                sx={{ position: 'absolute', inset: 0, p: 1, color: 'grey.400' }}
              >
                {media.error}
              </Typography>
            )}
          </Paper>
        )}
      </Box>

      {/* Barra de controles */}
      <Paper
        square
        elevation={8}
        sx={{ bgcolor: '#12201f', color: 'common.white', px: 2, py: 1.5, zIndex: 10 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {isPsi && (
            <>
              <Tooltip title={running ? 'Pausar' : 'Iniciar'}>
                <IconButton
                  onClick={toggleRun}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  {running ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Parar e reiniciar">
                <IconButton sx={{ color: 'common.white' }} onClick={stopBall}>
                  <StopIcon />
                </IconButton>
              </Tooltip>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ borderColor: 'rgba(255,255,255,0.15)' }}
              />
              <SpeedIcon fontSize="small" />
              <Slider
                size="small"
                value={speed}
                min={1}
                max={20}
                onChange={(_, v) => changeSpeed(v as number)}
                sx={{ width: 100 }}
                aria-label="Velocidade"
              />
              <ToggleButtonGroup
                size="small"
                exclusive
                value={movement}
                onChange={(_, v) => v && changeMovement(v)}
                sx={{
                  '& .MuiToggleButton-root': {
                    color: 'grey.300',
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                  '& .Mui-selected': {
                    color: '#fff !important',
                    bgcolor: 'primary.main !important',
                  },
                }}
              >
                {MOVEMENTS.map((m) => (
                  <ToggleButton key={m.value} value={m.value} title={m.label}>
                    {m.symbol}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <TextField
                select
                size="small"
                label="Movs."
                value={maxMovements}
                onChange={(e) => changeMax(Number(e.target.value))}
                sx={{
                  width: 96,
                  '& .MuiInputBase-root': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'grey.400' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {MOVEMENT_COUNTS.map((c) => (
                  <MenuItem key={c.value} value={c.value}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>
              {maxMovements > 0 && (
                <Chip
                  size="small"
                  label={`Restam ${movesLeft}`}
                  sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' }}
                />
              )}
              <Tooltip title={showBallLocal ? 'Ocultar bola (só para mim)' : 'Ver bola'}>
                <IconButton
                  sx={{ color: 'common.white' }}
                  onClick={() => setShowBallLocal((v) => !v)}
                >
                  {showBallLocal ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Cor da bola">
                <IconButton component="label" sx={{ color: 'common.white' }}>
                  <PaletteIcon />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => changeColor(e.target.value)}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                  />
                </IconButton>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'grey.400' }}>
                  Tam.
                </Typography>
                <Slider
                  size="small"
                  value={size}
                  min={8}
                  max={80}
                  onChange={(_, v) => changeSize(v as number)}
                  sx={{ width: 64 }}
                  aria-label="Tamanho"
                />
              </Box>
              <Tooltip title="Sons">
                <IconButton
                  sx={{ color: playing ? 'primary.light' : 'common.white' }}
                  onClick={(e) => setSoundAnchor(e.currentTarget)}
                >
                  <MusicNoteIcon />
                </IconButton>
              </Tooltip>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ borderColor: 'rgba(255,255,255,0.15)' }}
              />
            </>
          )}

          {/* Mic/câmera: apenas o psicólogo controla (paciente não liga/desliga). */}
          {isPsi && (
            <>
              <Tooltip title={media.micOn ? 'Desligar microfone' : 'Ligar microfone'}>
                <IconButton sx={{ color: 'common.white' }} onClick={media.toggleMic}>
                  {media.micOn ? <MicIcon /> : <MicOffIcon color="error" />}
                </IconButton>
              </Tooltip>
              <Tooltip title={media.camOn ? 'Desligar câmera' : 'Ligar câmera'}>
                <IconButton sx={{ color: 'common.white' }} onClick={media.toggleCam}>
                  {media.camOn ? <VideocamIcon /> : <VideocamOffIcon color="error" />}
                </IconButton>
              </Tooltip>
            </>
          )}
          {isPsi && (
            <Tooltip title="Convidar paciente">
              <IconButton sx={{ color: 'common.white' }} onClick={openInvite}>
                <PersonAddIcon />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Encerrar">
            <IconButton
              onClick={finish}
              sx={{ bgcolor: 'error.main', color: '#fff', '&:hover': { bgcolor: 'error.dark' } }}
            >
              <CallEndIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Popover de sons */}
      <Popover
        open={Boolean(soundAnchor)}
        anchorEl={soundAnchor}
        onClose={() => setSoundAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Typography variant="subtitle2" gutterBottom>
            Som bilateral
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={category}
            onChange={(_, v) => v && changeCategory(v)}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="tone">♩ Tons</ToggleButton>
            <ToggleButton value="music">♬ Ambiente</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            select
            fullWidth
            size="small"
            label="Faixa"
            value={track}
            onChange={(e) => changeTrack(e.target.value)}
            sx={{ mb: 2 }}
          >
            <MenuItem value="">Selecione…</MenuItem>
            {trackList.map((s) => (
              <MenuItem key={s.src} value={s.src}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Button
              variant={playing ? 'contained' : 'outlined'}
              size="small"
              onClick={toggleSound}
              disabled={!track}
            >
              {playing ? 'Pausar' : 'Tocar'}
            </Button>
            <Slider
              size="small"
              value={volume}
              min={0}
              max={100}
              onChange={(_, v) => changeVolume(v as number)}
              aria-label="Volume"
            />
          </Stack>
          <TextField
            select
            fullWidth
            size="small"
            label="Silenciar"
            value={muteTarget}
            onChange={(e) => changeMute(e.target.value as MuteTarget)}
          >
            <MenuItem value="none">Todos ouvem</MenuItem>
            <MenuItem value="psicologo">Mudo para mim (psicólogo)</MenuItem>
            <MenuItem value="paciente">Mudo para o paciente</MenuItem>
            <MenuItem value="ambos">Mudo para todos</MenuItem>
          </TextField>
        </Box>
      </Popover>

      {/* Convite */}
      <Dialog open={Boolean(inviteUrl)} onClose={() => setInviteUrl(null)}>
        <DialogTitle>Convite do paciente</DialogTitle>
        <DialogContent sx={{ minWidth: 360 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Envie este link ao paciente:
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              value={inviteUrl ?? ''}
              InputProps={{ readOnly: true }}
            />
            <IconButton
              color="primary"
              onClick={() => {
                if (inviteUrl) {
                  void navigator.clipboard.writeText(inviteUrl);
                  enqueueSnackbar('Link copiado!', { variant: 'success' });
                }
              }}
            >
              <ContentCopyIcon />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
            Ou envie direto para o paciente:
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="success"
              startIcon={<WhatsAppIcon />}
              onClick={() => sendInvite('whatsapp')}
            >
              WhatsApp
            </Button>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={() => sendInvite('email')}
            >
              E-mail
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Chat */}
      <Drawer anchor="right" open={chatOpen} onClose={() => setChatOpen(false)}>
        <Box sx={{ width: 320, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Typography variant="h6" sx={{ p: 2 }}>
            Chat
          </Typography>
          <Divider />
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {messages.map((m, i) => (
              <Box
                key={`${m.at}-${i}`}
                sx={{ mb: 1, textAlign: m.from === role ? 'right' : 'left' }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    display: 'inline-block',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: m.from === role ? 'primary.main' : 'grey.200',
                    color: m.from === role ? 'primary.contrastText' : 'text.primary',
                  }}
                >
                  {m.text}
                </Typography>
              </Box>
            ))}
            {messages.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhuma mensagem ainda.
              </Typography>
            )}
          </Box>
          <Divider />
          <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Mensagem"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitMessage()}
            />
            <IconButton color="primary" onClick={submitMessage}>
              <SendIcon />
            </IconButton>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
