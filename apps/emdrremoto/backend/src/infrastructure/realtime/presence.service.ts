import { Injectable } from '@nestjs/common';
import { PresencePort } from '../../contexts/paciente/application/ports/output/presence.port';

/**
 * Registro em memória de pacientes online (conectados a uma sala de sessão via Socket.IO).
 * Escrito pelo SessionGateway (entrada/saída) e lido pelo dashboard do psicólogo.
 * Ref-count por paciente para tolerar reconexões/StrictMode sem "piscar" a presença.
 */
@Injectable()
export class PresenceService implements PresencePort {
  private readonly counts = new Map<string, number>();

  connect(pacienteId: string): void {
    this.counts.set(pacienteId, (this.counts.get(pacienteId) ?? 0) + 1);
  }

  disconnect(pacienteId: string): void {
    const next = (this.counts.get(pacienteId) ?? 0) - 1;
    if (next <= 0) {
      this.counts.delete(pacienteId);
    } else {
      this.counts.set(pacienteId, next);
    }
  }

  isOnline(pacienteId: string): boolean {
    return (this.counts.get(pacienteId) ?? 0) > 0;
  }

  onlineIds(): string[] {
    return [...this.counts.keys()];
  }
}
