import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import MasterModel from "./MasterModel";
import Paciente from "./Paciente";
import Psicologo from "./Psicologo";

@Entity()
export default class Sessions extends MasterModel {
  @Column({ nullable: false, unique: true })
  session_id: string;

  @ManyToOne(() => Psicologo, (psicologo) => psicologo.psicologo_sessions)
  @JoinColumn()  
  psicologo: Psicologo;

  @ManyToOne(() => Paciente, (paciente) => paciente.pacient_sessions)
  @JoinColumn()
  paciente: Paciente;

  @Column({default: ''})
  paciente_socket_id: string;

  @Column({default:''})
  psicologo_socket_id: string;

  @Column({ nullable: false, unique: true })
  session_code: string;

  @Column({unique:true})
  daily_co_name: string;

  @Column({default:null})
  paciente_in: Date;

  @Column({default:null})
  psicologo_in: Date;

  @Column({default:null})
  session_out: Date;
}
