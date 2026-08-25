import React from "react";
import InputCustom from "../../../components/inputs/input-custom";
import SelectCustom from "../../../components/inputs/select-custom";
import PacienteService from "../../../services/paciente.service";
import { toast } from "react-toastify";

interface EditPacienteProps{
  paciente: any;
}

interface EditPacienteState {
  nome: string;
  email: string;
  telefone: number;
  ddi: any;
  status: any;
  id: any;
}

export default class EditPaciente extends React.Component<
  EditPacienteProps,
  EditPacienteState
> {
  constructor(props: EditPacienteProps) {
    super(props);

    this.state = {
      nome: this.props.paciente.nome,
      email: this.props.paciente.email,
      telefone: this.props.paciente.telefone,
      ddi: "",
      status: "",
      id: this.props.paciente.id,
    };

    this.handleChange = this.handleChange.bind(this);
    this.submitForm = this.submitForm.bind(this);
  }

  handleChange = (event: any) =>
    this.setState({ [event.target.name]: event.target.value } as any);

  async submitForm(event: any) {
    event.preventDefault();
    const paciente_service = new PacienteService();
    const data_to_send = {
      nome:this.state.nome,
      email:this.state.email,
      telefone:this.state.ddi + this.state.telefone,
      status:this.state.status,
    }
    try {
    const response: any = await paciente_service.update(this.state.id, data_to_send); 
    if (response.updated){
      toast.success("Paciente editado com sucesso!")
      setInterval(() => {
        window.location.reload();
      }, 1000);
    }else{
      toast.error("Erro ao editar paciente!")
    }
    } catch (error) {
      toast.error("Não foi possível editar o paciente, tente novamente!")
    }    
  }

  render() {
    return (
      <form
        className="flex flex-col gap-1 p-3 text-black bg-gray-50 rounded lg:p-10"
        onSubmit={(event) => this.submitForm(event)}
        onChange={this.handleChange}
      >
        <h2 className="mb-5 font-light text-center text-xl">
          Editar dados do paciente
        </h2>

        <InputCustom value={this.props.paciente.nome} label="nome" type="text" name="nome" placeholder="nome" />
        <InputCustom
          label="email"
          type="email"
          name="email"
          value={this.props.paciente.email}
          placeholder="email"
        />

        <label className="w-full mt-3 mb-1">
          {" "}
          <span className="mr-2 text-sm font-light">DDI</span>
          <SelectCustom
          name={"ddi"}
            handleChange
            options={[{ name: "Brasil", option: "+55" }]}
          />
        </label>

        <InputCustom
          label="telefone"
          type="tel"
          name="telefone"
          value={this.props.paciente.telefone}
          placeholder="numero de telefone"
        ></InputCustom>

        <label className="w-full mt-3 mb-1">
          {" "}
          <span className="mr-2 text-sm font-light">Status</span>
          <SelectCustom
          name={"status"}
            handleChange
            options={[{ name: "ativo", option: "ativo" }, {name: "inativo", option: "inativo"}]}
          />
        </label>

        <div className="flex justify-around gap-2 mt-3">
          <button className="w-full p-3 bg-gray-100 border border-gray-200 text-blue-900 rounded hover:bg-gray-300">
            Confirmar
          </button>
        </div>
      </form>
    );
  }
}
