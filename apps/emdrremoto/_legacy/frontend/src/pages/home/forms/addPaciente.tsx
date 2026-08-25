import React from "react";
import InputCustom from "../../../components/inputs/input-custom";
import SelectCustom from "../../../components/inputs/select-custom";
import PacienteService from "../../../services/paciente.service";
import { toast } from "react-toastify";
import CookiesProvider from "../../../providers/Cookies.provider";
import ddis from "../../../utils/ddi";
interface PacienteProps {
  closeModal: any;
}

interface PacienteState {
  nome: string;
  email: string;
  telefone: number;
  ddi: any;
}

export default class AddPaciente extends React.Component<
  PacienteProps,
  PacienteState
> {
  constructor(props: PacienteProps) {
    super(props);

    this.state = {
      nome: "",
      email: "",
      telefone: 0,
      ddi: "",
    };

    this.handleChange = this.handleChange.bind(this);
    this.submitForm = this.submitForm.bind(this);
  }

  handleChange = (event: any) =>
    this.setState({ [event.target.name]: event.target.value } as any);

  async submitForm(event: any) {
    event.preventDefault();
    const paciente_service = new PacienteService();
    const cookies = new CookiesProvider();
    const psicologo_cookie = await cookies.getUserData();
    const id = psicologo_cookie.user.id;
    const data_to_send = {
      email: this.state.email,
      nome: this.state.nome,
      telefone: this.state.ddi + this.state.telefone,
      psicologo: id,
    };
    try {
      const response = await paciente_service.create(data_to_send);
      toast.success("Paciente cadastrado com sucesso!");
      window.location.href = "/home";
    } catch (error) {
      toast.error("Erro ao cadastrar paciente!");
    }
  }

  render() {
    return (
      <form
        className="flex flex-col gap-1 p-3 bg-gray-50 rounded lg:p-10"
        onSubmit={(event) => this.submitForm(event)}
        onChange={this.handleChange}
      >
        <h2 className="mb-5 font-light text-center text-xl">
          Informações do paciente
        </h2>

        <InputCustom label="nome" type="text" name="nome" placeholder="nome" />
        <InputCustom
          label="email"
          type="email"
          name="email"
          placeholder="email"
        />

        <label className="w-full mt-3 mb-1">
          {" "}
          <span className="mr-2 text-sm font-light">DDI</span>
          <SelectCustom name={"ddi"} handleChange options={ddis} />
        </label>

        <InputCustom
          label="telefone"
          type="tel"
          name="telefone"
          placeholder="numero de telefone"
        ></InputCustom>

        <div className="flex justify-around gap-2 mt-3">
          <button
            onClick={this.props.closeModal}
            className="w-full p-3 bg-gray-100 text-blue-900 border-gray-200 border rounded hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button className="w-full p-3 bg-gray-100 text-blue-900  border border-gray-200 rounded hover:bg-gray-300">
            Confirmar
          </button>
        </div>
      </form>
    );
  }
}
