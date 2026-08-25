import React, { ReactElement } from 'react';

interface MensagemEnviadaProps {
  mensagem: {
    id: string;
    texto: string;
    remetente: string;
    data: string;
  };
}

export default class MensagemEnviada extends React.Component<MensagemEnviadaProps> {
  render(): ReactElement {
    const { mensagem } = this.props;
    const dataFormatada = mensagem?.data 
      ? new Date(mensagem.data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <article 
        className="flex flex-row-reverse flex-wrap py-1 m-2 ml-10 lg:border-b lg:px-5"
        aria-label="Sua mensagem"
      >
        <div className="max-w-xs px-5 py-3 bg-blue-100 rounded-lg shadow-sm lg:max-w-2xl">
          <div 
            className="px-2 text-sm text-left text-gray-800 break-words"
            aria-label="Conteúdo da mensagem"
          >
            <p>{mensagem.texto}</p>
          </div>
          <div 
            className="text-xs text-right text-gray-500 mt-1"
            aria-label="Horário da mensagem"
          >
            {dataFormatada}
          </div>
        </div>
      </article>
    );
  }
}