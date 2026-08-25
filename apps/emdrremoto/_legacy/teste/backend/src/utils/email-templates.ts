export default class EmailTemplates{
    public pacienteLink = async(nome_paciente:string, link:string) => {
        const template = `
            <h3>Olá, ${nome_paciente}</h3>
            <h4>Seu link de acesso para a sessão com o psicólogo é: <a href="${link}">${link}</a></h4>
            <p>Atenciosamente,</p>
            <p>Equipe PSI</p>  
        `;
        return template;
    }
}