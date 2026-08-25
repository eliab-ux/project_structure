import { useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import PacienteService from "../services/paciente.service";

const PacienteSalaRedirect = () => {
    const { hash } = useParams<{ hash: string }>();
    const history = useHistory();

    useEffect(() => {
        const validarHashPaciente = async () => {
            try {
                const paciente_service: any = new PacienteService();
                const res = await paciente_service.verifyHash(hash);
        
                if (res.paciente.pacient_sessions[0].session_code) {
                    window.location.href = `/emdr/paciente/${res.paciente.pacient_sessions[0].session_code}`;
                    //history.replace(`/emdr/paciente/${res.paciente.pacient_sessions[0].session_code}`);
                } else {
                    history.replace("/acesso-negado");
                }
            } catch (error) {
                return;
            }
        };

        validarHashPaciente();
    }, [hash, history]);

    return null;
};

export default PacienteSalaRedirect;
