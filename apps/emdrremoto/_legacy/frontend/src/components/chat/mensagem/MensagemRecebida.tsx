import React, { ReactElement } from 'react';

interface MensagemRecebidaProps {
  mensagem: {
    id: string;
    texto: string;
    remetente: string;
    data: string;
  };
}

export default class MensagemRecebida extends React.Component<MensagemRecebidaProps> {
  render(): ReactElement {
    const { mensagem } = this.props;
    const dataFormatada = mensagem?.data 
      ? new Date(mensagem.data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <article 
        className="flex flex-row flex-wrap py-1 m-2 mr-10 lg:border-b lg:px-5"
        aria-label={`Mensagem de ${mensagem.remetente}`}
      >
        <div className="max-w-xs px-5 py-3 bg-gray-100 rounded-lg shadow-sm lg:max-w-2xl">
          <div 
            className="px-2 py-1 font-semibold text-left text-gray-800"
            aria-label="Remetente"
          >
            {mensagem.remetente}
          </div>
          <div 
            className="px-2 text-sm text-left text-gray-700 break-words"
            aria-label="Conteúdo da mensagem"
          >
            {mensagem.texto}
          </div>
          <div 
            className="px-2 py-1 mt-1 text-xs font-medium text-right text-gray-500"
            aria-label="Horário da mensagem"
          >
            {dataFormatada}
          </div>
        </div>
      </article>
    );
  }
}