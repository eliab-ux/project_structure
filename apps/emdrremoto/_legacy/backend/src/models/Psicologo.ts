import { Column, Entity, OneToMany } from "typeorm";
import MasterModel from "./MasterModel";
import Sessions from "./Sessions";
import Paciente from "./Paciente";

@Entity()
export default class Psicologo extends MasterModel {

  @Column({ nullable: false })
  email: string;

  @Column({ nullable: false })
  nome: string;

  @OneToMany(()=> Sessions, (session) => session.psicologo, {eager: true, onUpdate: 'CASCADE'})
  psicologo_sessions: Sessions[]

  @OneToMany(() => Paciente, (paciente) => paciente.psicologo,{eager: true,  onDelete: 'CASCADE'} )
  pacientes: Paciente[]

  @Column({ nullable: false })
  telefone: string;

  @Column({})
  codigo_recuperacao: string;

  @Column({ nullable: false })
  senha: string;

  @Column({default: false})
  email_verificado: boolean

}
