import React from "react";
import EditProfileBtn from "../../../components/buttons/EditProfileBtn";
import InviteBtn from "../../../components/buttons/sendInviteBtn";
import InputCustom from "../../../components/inputs/input-custom";
import Modal from "../../../components/modals/modal";
import CookiesProvider from "../../../providers/Cookies.provider";
import PacienteService from "../../../services/paciente.service";
import PsicologoService from "../../../services/psicologo.service";
import Invite from "../invite";
import { pacientes } from "../mocks/pacientes";
import BtnActionGroup from "./btnActionGroup";

interface tableState {
  pacientes: any;
  todosPacientes: any;
}

export default class TableMenu extends React.Component<any, tableState> {
  constructor(props: any) {
    super(props);
    this.state = { pacientes: [], todosPacientes: [] };
    this.search = this.search.bind(this);
  }

  async componentDidMount() {
    const cookie_service = new CookiesProvider();
    const {user} = cookie_service.getUserData();
    const psicologo_id = user.id;

    const psicologo_service = new PsicologoService();
    const {pacientes}: any = await psicologo_service.buscarPacientes(psicologo_id)

    this.setState({ todosPacientes: pacientes }, () =>
      this.setState({ pacientes: this.state.todosPacientes })
    );
  }

  search(event: any) {
    const searchInput = event.target.value;
    const filterPacientes = this.state.todosPacientes.filter(
      (paciente: any) =>
        paciente.nome.includes(searchInput) ||
        paciente.telefone.toString().includes(searchInput) ||
        paciente.email.includes(searchInput)
    );
    this.setState({ pacientes: filterPacientes });
  }

  render() {
    return (
      <section className="font-light md:px-10">
        <form
          className="md:w-1/2 w-full md:p-10 p-3"
          onChange={(event) => this.search(event)}
        >
          <InputCustom
            name="pesquisa"
            type="search"
            placeholder="Pesquisar paciente"
          />
        </form>

        <article className="grid grid-cols-1 py-3 pl-5 mx-0 text-white bg-blue-900 rounded-t md:mx-10 md:grid-cols-2 lg:grid-cols-4">
          {" "}
          {/* paciente */}
          <h3 className="col-span-1">Nome</h3>
          <h3 className="col-span-1">E-mail</h3>
          <h3 className="col-span-1">Telefone</h3>
          <div className="col-span-1">Ações</div>
        </article>

        {this.state.pacientes.map((paciente: any, index: any) => (
          <article
            key={"paciente-" + index}
            className="grid items-center grid-cols-1 py-3 pl-5 mx-0 border-b md:mx-10 md:grid-cols-2 lg:grid-cols-4"
          >
            {" "}
            {/* paciente */}
            <h3 className="col-span-1"> {paciente.nome} </h3>
            <h3 className="col-span-1">{paciente.email}</h3>
            <h3 className="col-span-1">{paciente.telefone}</h3>
            <BtnActionGroup paciente={paciente}></BtnActionGroup>
          </article>
        ))}
      </section>
    );
  }
}
