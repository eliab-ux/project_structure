import { useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";

const BloqueioMobile = () => {
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    const jaEstaNaPaginaNegada = location.pathname === "/acesso-negado";

    if (isMobile && !jaEstaNaPaginaNegada) {
      history.replace("/acesso-negado");
    }
  }, [history, location]);

  return null;
};

export default BloqueioMobile;
