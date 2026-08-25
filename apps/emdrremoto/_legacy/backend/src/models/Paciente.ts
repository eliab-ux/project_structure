import {
  Column,
  Entity,
  OneToMany,
  ManyToOne,
  BeforeInsert,
} from "typeorm";
import MasterModel from "./MasterModel";
import Sessions from "./Sessions";
import Psicologo from "./Psicologo";
import { randomBytes } from "crypto";

@Entity()
export default class Paciente extends MasterModel {
  @Column({ nullable: false })
  email: string;

  @Column({ nullable: false })
  nome: string;

  @OneToMany(() => Sessions, (session) => session.paciente, { eager: true })
  pacient_sessions: Sessions[];

  @Column({ nullable: true })
  pais: string;

  @ManyToOne(() => Psicologo, (psicologo) => psicologo.id, { nullable: false })
  psicologo: Psicologo;

  @Column({ nullable: false })
  telefone: string;

  @Column({ nullable: false, unique: true })
  hash: string;

  @BeforeInsert()
  generateUniqueHash() {
    this.hash = randomBytes(8).toString("hex");
  }
}
