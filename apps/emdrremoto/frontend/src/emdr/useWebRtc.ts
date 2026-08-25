'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface UseWebRtcParams {
  socket: Socket | null;
  joined: boolean;
  localStream: MediaStream | null;
  /** Só um lado cria a offer (evita glare). O psicólogo é o iniciador. */
  isInitiator: boolean;
}

/**
 * Vídeo P2P (WebRTC) com sinalização pelo MESMO socket/room.
 * Handshake: cada lado registra os listeners e então emite `rtc-ready`. O iniciador só
 * cria a offer ao saber que o outro está pronto — assim a offer nunca chega antes de o par
 * ter o listener de `webrtc-offer` (corrige a corrida que deixava os dois "aguardando").
 */
export function useWebRtc({ socket, joined, localStream, isInitiator }: UseWebRtcParams) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const peerReadyRef = useRef(false);
  const negotiatedRef = useRef(false);
  const repliedRef = useRef(false);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  localRef.current = localStream;

  useEffect(() => {
    if (!socket || !joined) return undefined;

    const ensurePc = (): RTCPeerConnection | null => {
      if (pcRef.current) return pcRef.current;
      if (!localRef.current) return null;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      localRef.current.getTracks().forEach((t) => pc.addTrack(t, localRef.current as MediaStream));
      pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc-ice', e.candidate.toJSON());
      };
      pcRef.current = pc;
      return pc;
    };

    const drainIce = async (pc: RTCPeerConnection) => {
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => undefined);
      pendingIce.current = [];
    };

    const tryOffer = async () => {
      if (!isInitiator || negotiatedRef.current || !peerReadyRef.current) return;
      const pc = ensurePc();
      if (!pc) return; // sem mídia local ainda; tenta de novo quando o stream chegar
      negotiatedRef.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { type: offer.type, sdp: offer.sdp });
    };

    const onPeerReady = () => {
      if (isInitiator) {
        // O iniciador registra que o par está pronto e oferta (sem reanunciar → sem eco).
        peerReadyRef.current = true;
        void tryOffer();
      } else if (!repliedRef.current) {
        // O não-iniciador responde UMA vez, para o iniciador saber que já pode ofertar.
        repliedRef.current = true;
        socket.emit('rtc-ready');
      }
    };
    const onOffer = async (desc: RTCSessionDescriptionInit) => {
      const pc = ensurePc();
      if (!pc) return;
      await pc.setRemoteDescription(desc);
      await drainIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      negotiatedRef.current = true;
      socket.emit('webrtc-answer', { type: answer.type, sdp: answer.sdp });
    };
    const onAnswer = async (desc: RTCSessionDescriptionInit) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(desc);
      await drainIce(pc);
    };
    const onIce = async (candidate: RTCIceCandidateInit) => {
      const pc = pcRef.current;
      if (pc?.remoteDescription) await pc.addIceCandidate(candidate).catch(() => undefined);
      else pendingIce.current.push(candidate);
    };

    // Registra TODOS os listeners ANTES de anunciar que está pronto.
    socket.on('rtc-ready', onPeerReady);
    socket.on('webrtc-offer', onOffer);
    socket.on('webrtc-answer', onAnswer);
    socket.on('webrtc-ice', onIce);
    socket.emit('rtc-ready');

    return () => {
      socket.off('rtc-ready', onPeerReady);
      socket.off('webrtc-offer', onOffer);
      socket.off('webrtc-answer', onAnswer);
      socket.off('webrtc-ice', onIce);
      pcRef.current?.close();
      pcRef.current = null;
      negotiatedRef.current = false;
      peerReadyRef.current = false;
      repliedRef.current = false;
      pendingIce.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, joined, isInitiator]);

  // Se a mídia local chegar depois do "pronto" do par, dispara a offer agora.
  useEffect(() => {
    if (!localStream || !socket || !isInitiator || negotiatedRef.current || !peerReadyRef.current) {
      return;
    }
    const pc = new RTCPeerConnection(RTC_CONFIG);
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('webrtc-ice', e.candidate.toJSON());
    };
    pcRef.current = pc;
    negotiatedRef.current = true;
    void pc.createOffer().then((o) => {
      void pc.setLocalDescription(o);
      socket.emit('webrtc-offer', { type: o.type, sdp: o.sdp });
    });
  }, [localStream, socket, isInitiator]);

  return { remoteStream };
}
