import React from 'react';
import { useHistory } from 'react-router-dom';
import fundoImg from '../../assets/images/fundo.png';
import logoImg from '../../assets/images/emdrLogo.png';
import './styles.css';

const LandingPage: React.FC = () => {
  const history = useHistory();
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    // Pré-carrega a imagem de fundo. Quando terminar, some com o spinner.
    const img = new Image();
    img.src = fundoImg;
    img.onload = () => {
      setIsLoaded(true);
    };
  }, []);

  // Fallback: caso o onload não dispare (erro de rede, imagem muito grande etc.)
  // garantimos que a tela não fique eternamente em "Carregando…".
  React.useEffect(() => {
    const timeout = setTimeout(() => setIsLoaded(true), 4000);
    return () => clearTimeout(timeout);
  }, []);

  const handleEntrar = () => {
    history.push('/login');
  };

  const handlePlanos = () => {
    history.push('/planos');
  };

  return (
    <>
      <div className={`loading-indicator ${!isLoaded ? 'visible' : ''}`}>
        <div className="loading-spinner"></div>
        <div className="loading-text">Carregando...</div>
      </div>
      
      <div 
        className={`landing-container ${isLoaded ? 'loaded' : ''}`} 
        role="main" 
        aria-label="Página principal"
        style={{
          '--bg-image': `url(${fundoImg})`,
        } as React.CSSProperties}
      >
      <header className="landing-header" role="banner">
        <div className="logo">
          <img src={logoImg} alt="EMDR Terapia Logo" className="logo-img" />
          <h1>EMDR TERAPIA</h1>
        </div>
      </header>

      <main className="landing-main">
        <p className="tagline">Plataforma completa para psicólogos que realizam terapia EMDR</p>
        
        <div className="cta-buttons" role="navigation" aria-label="Navegação principal">
          <button 
            onClick={handleEntrar} 
            className="btn btn-primary"
            aria-label="Entrar no sistema"
          >
            ENTRAR NO SISTEMA
          </button>
          <button 
            onClick={handlePlanos} 
            className="btn btn-secondary"
            aria-label="Ver planos e assinaturas"
          >
            PLANOS E ASSINATURAS
          </button>
        </div>

        <div className="sobre-sistema">
          <h2>Sobre o Sistema</h2>
          <div className="sobre-conteudo">
            <p>Desenvolvido por especialistas da Equipamentos PSI, nossa solução nasceu da prática clínica real com EMDR, unindo tecnologia simples e útil para o psicólogo que deseja foco no paciente e não na ferramenta.</p>
          </div>
        </div>
      </main>

        <footer className="landing-footer" role="contentinfo">
          <p>© {new Date().getFullYear()} Equipamentos PSI. Todos os direitos reservados.</p>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;