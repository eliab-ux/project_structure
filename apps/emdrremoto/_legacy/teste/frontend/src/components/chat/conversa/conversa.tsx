import React from 'react';
import MensagemRecebida from '../mensagem/MensagemRecebida';
import MensagemEnviada from '../mensagem/mensagemEnviada';
import { conversaDummy } from '../dummy/conversa';

interface Mensagem {
  id: string;
  texto: string;
  remetente: string;
  data: string;
  nome?: string; // Para compatibilidade com o código existente
  horario?: string; // Para compatibilidade com o código existente
}

interface ConversaProps {
  chat: Mensagem[];
}

interface ConversaState {
  chat: Mensagem[];
}

export default class Conversa extends React.Component<ConversaProps, ConversaState> {
  constructor(props: ConversaProps) {
    super(props);
    this.state = {
      chat: this.props.chat
    };
  }

  componentDidMount() {
    this.setState({ chat: [...this.props.chat] });
  }

  formatarMensagem(mensagem: Mensagem): Mensagem {
    // Extrai as propriedades que queremos sobrescrever
    const { id, texto, remetente, data, nome, horario, ...rest } = mensagem;
    
    // Retorna o objeto formatado com as propriedades sobrescritas
    return {
      ...rest,
      id: id || Date.now().toString(),
      texto: texto || '',
      remetente: nome || remetente || 'Remetente',
      data: horario || data || new Date().toISOString()
    };
  }

  render() {
    return (
      <div>
        {this.state.chat.map((mensagem: Mensagem) => {
          const mensagemFormatada = this.formatarMensagem(mensagem);
          
          if (mensagem.nome) {
            return <MensagemRecebida key={mensagemFormatada.id} mensagem={mensagemFormatada} />;
          } else {
            return <MensagemEnviada key={mensagemFormatada.id} mensagem={mensagemFormatada} />;
          }
        })}
      </div>
    );
  }
}