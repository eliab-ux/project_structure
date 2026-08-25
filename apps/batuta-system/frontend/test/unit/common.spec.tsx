import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusChip,
  formatAge,
  formatDateTime,
  formatRate,
} from 'src/components/common/common';

describe('formatAge', () => {
  it('reads as a person would say it', () => {
    expect(formatAge(0)).toBe('0 min');
    expect(formatAge(45)).toBe('45 min');
    expect(formatAge(60)).toBe('1h');
    expect(formatAge(95)).toBe('1h 35min');
    expect(formatAge(1440)).toBe('1d');
    expect(formatAge(1500)).toBe('1d 1h');
  });

  it('a three-day-old item is unmistakable, not "4320 min"', () => {
    // §10.3: an item sitting for three days is worse than not having the queue, so the number has to
    // land immediately rather than needing arithmetic.
    expect(formatAge(4320)).toBe('3d');
  });
});

describe('formatRate', () => {
  it('distinguishes "no sample" from "zero"', () => {
    // A brand-new chip that never sent has a null delivery rate. Rendering it as 0% would read as a
    // catastrophe on a channel that is simply new.
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0)).toBe('0.0%');
    expect(formatRate(0.9712)).toBe('97.1%');
  });
});

describe('formatDateTime', () => {
  it('shows an em dash for absent dates instead of "Invalid Date"', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('formats a real date in pt-BR', () => {
    expect(formatDateTime('2026-08-04T15:30:00Z')).toMatch(/04\/08\/2026/);
  });
});

describe('StatusChip', () => {
  it('renders the status readably, without underscores', () => {
    render(<StatusChip status="PENDING_REPLY" />);

    expect(screen.getByText('PENDING REPLY')).toBeInTheDocument();
  });

  it('gives the same word the same colour everywhere', () => {
    // One table drives the colours, so amber cannot mean "attention" on one screen and something else
    // on the next.
    const { container: connected } = render(<StatusChip status="CONNECTED" />);
    const { container: healthy } = render(<StatusChip status="HEALTHY" />);

    expect(connected.querySelector('.MuiChip-colorSuccess')).not.toBeNull();
    expect(healthy.querySelector('.MuiChip-colorSuccess')).not.toBeNull();
  });

  it('an unknown status still renders, outlined rather than coloured', () => {
    const { container } = render(<StatusChip status="ALGO_NOVO" />);

    expect(screen.getByText('ALGO NOVO')).toBeInTheDocument();
    expect(container.querySelector('.MuiChip-outlined')).not.toBeNull();
  });
});

describe('accessibility of the shared states', () => {
  it('Loading announces itself as a status', () => {
    render(<Loading label="Carregando canais" />);

    expect(screen.getByRole('status', { name: 'Carregando canais' })).toBeInTheDocument();
  });

  it('ErrorState announces itself as an alert', () => {
    render(<ErrorState message="Falhou" />);

    // role="alert" is what makes a screen reader speak the failure instead of leaving it silent.
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
  });

  it('ErrorState offers a retry only when there is something to retry', () => {
    const { rerender } = render(<ErrorState message="Falhou" />);
    expect(screen.queryByRole('button', { name: /tentar de novo/i })).toBeNull();

    rerender(<ErrorState message="Falhou" onRetry={() => undefined} />);
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
  });

  it('PageHeader is a header with the title as a heading', () => {
    render(<PageHeader title="Canais" description="Cada canal é um chip." />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Canais' })).toBeInTheDocument();
  });

  it('EmptyState carries a way forward, not just a sentence', () => {
    render(<EmptyState title="Nenhum canal" action={<button type="button">Cadastrar</button>} />);

    expect(screen.getByRole('button', { name: 'Cadastrar' })).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('keeps the confirm button disabled until the word is typed exactly', async () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Declarar canal banido"
        description="Estado terminal e irreversível."
        confirmationWord="BANIDO"
        confirmLabel="Declarar banido"
        destructive
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Declarar banido' });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/digite banido/i), 'BANID');
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/digite banido/i), 'O');
    expect(confirm).toBeEnabled();
  });

  it('accepts the word in any case — the friction is the typing, not the caps lock', async () => {
    render(
      <ConfirmDialog
        open
        title="Migrar"
        description="Move contatos."
        confirmationWord="MIGRAR"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    await userEvent.type(screen.getByLabelText(/digite migrar/i), 'migrar');

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
  });

  it('hands the reason to the caller, so it reaches the audit trail', async () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Cancelar"
        description="Cancela pendentes."
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(screen.getByLabelText(/motivo/i), 'texto errado');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onConfirm).toHaveBeenCalledWith('texto errado');
  });

  it('without a confirmation word it is enabled from the start', () => {
    render(
      <ConfirmDialog
        open
        title="Resolver"
        description="Fecha o item."
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
  });
});
