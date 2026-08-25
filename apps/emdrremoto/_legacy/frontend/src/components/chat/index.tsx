import React, { FormEvent, KeyboardEvent, RefObject } from "react";
import { Socket } from "socket.io-client";
import addNotification from 'react-push-notification';
import MensagemRecebida from "./mensagem/MensagemRecebida";
import MensagemEnviada from "./mensagem/mensagemEnviada";
import { conversaDummy } from "./dummy/conversa";

interface Mensagem {
  id: string;
  texto: string;
  remetente: string;
  data: string;
}

interface ChatProps {
  socket: Socket;
  trigger: () => void;
}

interface ChatState {
  conversa: Mensagem[];
  mensagem: string;
  myRef: RefObject<HTMLDivElement>;
}

export default class Chat extends React.Component<ChatProps, ChatState> {
  constructor(props: ChatProps) {
    super(props);

    this.state = {
      conversa: [],
      mensagem: "",
      myRef: React.createRef<HTMLDivElement>(),
    };

    // Bind methods in the constructor
    this.handleChange = this.handleChange.bind(this);
    this.enviarMensagem = this.enviarMensagem.bind(this);
    this.executeScroll = this.executeScroll.bind(this);
    this.newMessage = this.newMessage.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  componentDidMount() {
    const { socket } = this.props;
    
    this.setState({ conversa: conversaDummy }, () => this.executeScroll());
    
    socket.emit('update-messages');
    
    socket.on("update-messages", (data: { message: Mensagem }[]) => {
      data.forEach(({ message }) => {
        this.newMessage(message);
      });
    });
    
    socket.on("new-message", ({ message }: { message: Mensagem }) => {
      const texto = message.texto.length > 25 
        ? `${message.texto.slice(0, 25)}...` 
        : message.texto;
        
      addNotification({
        title: 'Nova mensagem',
        colorTop: 'green',
        subtitle: 'Você tem uma nova mensagem',
        message: `'${texto}'`,
        closeButton: 'OK',
        duration: 5000,
        theme:'light',
      });
      this.newMessage(message);
    });
  }

  executeScroll = () => {
    if (this.state.myRef.current) {
      this.state.myRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  newMessage = (message: Mensagem) => {
    this.setState(
      prevState => ({
        conversa: [...prevState.conversa, message],
        mensagem: ""
      }),
      this.executeScroll
    );
  };

  enviarMensagem(event: FormEvent) {
    event.preventDefault();
    const { mensagem } = this.state;
    
    if (mensagem.trim() === "") return;

    const novaMensagem: Mensagem = {
      id: Math.random().toString(36).substring(2, 9),
      texto: mensagem,
      remetente: "eu",
      data: new Date().toISOString(),
    };

    this.props.socket.emit("new-message", { message: novaMensagem });

    this.setState(
      prevState => ({
        conversa: [...prevState.conversa, novaMensagem],
        mensagem: ""
      }),
      this.executeScroll
    );
  }

  handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setState({ mensagem: event.target.value });
  }
  
  handleKeyPress(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensagem(event as unknown as FormEvent);
    }
  }

  render() {
    const { conversa, mensagem } = this.state;
    
    return (
      <div className="w-full h-full flex flex-col bg-white rounded-lg shadow">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversa.map((mensagem, index) => (
            mensagem.remetente === "eu" 
              ? <MensagemEnviada key={`${mensagem.id}-${index}`} mensagem={mensagem} />
              : <MensagemRecebida key={`${mensagem.id}-${index}`} mensagem={mensagem} />
          ))}
          <div ref={this.state.myRef} aria-hidden="true" />
        </div>
        
        <form
          onSubmit={this.enviarMensagem}
          className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg"
        >
          <div className="flex items-end space-x-2">
            <div className="flex-1 relative">
              <textarea
                value={mensagem}
                onChange={this.handleChange}
                onKeyPress={this.handleKeyPress}
                placeholder="Digite sua mensagem..."
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={Math.min(4, mensagem.split('\n').length)}
                aria-label="Digite sua mensagem"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
              disabled={!mensagem.trim()}
              aria-label="Enviar mensagem"
            >
              Enviar
            </button>
          </div>
        </form>
      </div>
    );
  }
}
