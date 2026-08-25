import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from 'src/app/reset-password/page';

const replace = jest.fn();
const enqueueSnackbar = jest.fn();
const requestPasswordReset = jest.fn();
const resetPassword = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

jest.mock('src/services/services', () => ({
  authService: {
    requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
    resetPassword: (...args: unknown[]) => resetPassword(...args),
  },
}));

async function reachCodeStep(email = 'maria@exemplo.com'): Promise<void> {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
  await waitFor(() => expect(screen.getByLabelText(/código de 6 dígitos/i)).toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
  requestPasswordReset.mockResolvedValue(undefined);
  resetPassword.mockResolvedValue(undefined);
});

describe('página de recuperação de senha', () => {
  it('is a <main> with a heading — landmarks, not a bare div', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recuperar senha' })).toBeInTheDocument();
  });

  it('asks for the e-mail first and nothing else', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    // The code field must not exist yet: there is no code to type before asking for one.
    expect(screen.queryByLabelText(/código/i)).toBeNull();
  });

  it('moves to the code step after requesting, carrying the e-mail forward', async () => {
    render(<ResetPasswordPage />);

    await reachCodeStep();

    expect(requestPasswordReset).toHaveBeenCalledWith('maria@exemplo.com');
    await userEvent.type(screen.getByLabelText(/código de 6 dígitos/i), '123456');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'senha-nova-123');
    await userEvent.type(screen.getByLabelText('Confirme a nova senha'), 'senha-nova-123');
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    // The e-mail is the one typed in step 1 — the user never types it twice.
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith('maria@exemplo.com', '123456', 'senha-nova-123'),
    );
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('never confirms whether the e-mail exists', async () => {
    render(<ResetPasswordPage />);

    await reachCodeStep('desconhecido@exemplo.com');

    // A message that distinguished "sent" from "unknown address" would be an enumeration oracle.
    const message = enqueueSnackbar.mock.calls.map(([text]) => String(text)).join(' ');
    expect(message).toMatch(/se este e-mail estiver cadastrado/i);
  });

  it('warns that a real message never carries a link', async () => {
    render(<ResetPasswordPage />);

    await reachCodeStep();

    // The anti-phishing line is part of the flow, not decoration: teaching the shape of the real
    // message is what makes the fake one recognisable.
    expect(screen.getByRole('status')).toHaveTextContent(/nunca enviamos link/i);
  });

  it('rejects a code that is not six digits before calling the API', async () => {
    render(<ResetPasswordPage />);
    await reachCodeStep();

    await userEvent.type(screen.getByLabelText(/código de 6 dígitos/i), '123');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'senha-nova-123');
    await userEvent.type(screen.getByLabelText('Confirme a nova senha'), 'senha-nova-123');
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(screen.getByText('O código tem 6 dígitos')).toBeInTheDocument());
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('enforces the SAME minimum the backend does — 10, not 8', async () => {
    render(<ResetPasswordPage />);
    await reachCodeStep();

    await userEvent.type(screen.getByLabelText(/código de 6 dígitos/i), '123456');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'curta123');
    await userEvent.type(screen.getByLabelText('Confirme a nova senha'), 'curta123');
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    // Announcing 8 and then being refused by the API is the worst of both worlds.
    await waitFor(() => expect(screen.getByText('Mínimo 10 caracteres')).toBeInTheDocument());
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('refuses mismatched confirmation', async () => {
    render(<ResetPasswordPage />);
    await reachCodeStep();

    await userEvent.type(screen.getByLabelText(/código de 6 dígitos/i), '123456');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'senha-nova-123');
    await userEvent.type(screen.getByLabelText('Confirme a nova senha'), 'senha-nova-124');
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument());
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('offers a way back to step 1 when the code never arrives', async () => {
    render(<ResetPasswordPage />);
    await reachCodeStep();

    await userEvent.click(screen.getByRole('button', { name: /não recebi o código/i }));

    await waitFor(() => expect(screen.queryByLabelText(/código de 6 dígitos/i)).toBeNull());
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument();
  });

  it('stays on step 1 and reports the failure when the channel is down', async () => {
    requestPasswordReset.mockRejectedValue(new Error('canal indisponível'));
    render(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));

    // Advancing to a code step that can never be satisfied would be a dead end.
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), { variant: 'error' }),
    );
    expect(screen.queryByLabelText(/código de 6 dígitos/i)).toBeNull();
  });

  it('shows the failure when the code is wrong, and does not navigate away', async () => {
    resetPassword.mockRejectedValue(new Error('inválido'));
    render(<ResetPasswordPage />);
    await reachCodeStep();

    await userEvent.type(screen.getByLabelText(/código de 6 dígitos/i), '000000');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'senha-nova-123');
    await userEvent.type(screen.getByLabelText('Confirme a nova senha'), 'senha-nova-123');
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });
});
