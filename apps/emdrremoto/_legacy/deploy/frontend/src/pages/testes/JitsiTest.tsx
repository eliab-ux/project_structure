import React, { useEffect, useRef } from "react";

// Adiciona a tipagem para JitsiMeetExternalAPI no objeto window
declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

const JitsiTest: React.FC = () => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Carrega o script externo do Jitsi se ainda não estiver carregado
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => startConference();
      document.body.appendChild(script);
    } else {
      startConference();
    }

    function startConference() {
      if (!jitsiContainerRef.current) return;
      // Gera um nome de sala aleatório para o teste
      const roomName = "TesteEMDR_" + Math.floor(Math.random() * 100000);
      // eslint-disable-next-line no-undef
      const api = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName,
        parentNode: jitsiContainerRef.current,
        width: "100%",
        height: 600,
        userInfo: {
          displayName: "Teste EMDR"
        }
      });
      // Opcional: eventos, comandos, etc.
      api.executeCommand("subject", "Teste Jitsi Meet");
    }

    // Limpeza ao desmontar
    return () => {
      if (jitsiContainerRef.current) {
        jitsiContainerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Teste de Videoconferência Jitsi Meet</h1>
      <div ref={jitsiContainerRef} style={{ width: "100%", maxWidth: 900, minHeight: 600, background: "#222" }} />
    </div>
  );
};

export default JitsiTest;