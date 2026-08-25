import { AxiosError } from 'axios';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  apiErrorMessage,
  clearSession,
  getStoredToken,
  storeSession,
} from 'src/services/api';

describe('session storage', () => {
  it('stores the pair of tokens and the user together', () => {
    storeSession('access-1', 'refresh-1', { id: 'u1', name: 'Maria' });

    expect(getStoredToken(ACCESS_TOKEN_KEY)).toBe('access-1');
    expect(getStoredToken(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    expect(JSON.parse(window.localStorage.getItem(USER_KEY) ?? '{}')).toMatchObject({
      name: 'Maria',
    });
  });

  it('clearSession removes ALL three keys', () => {
    storeSession('access-1', 'refresh-1', { id: 'u1' });

    clearSession();

    // Leaving the cached user behind would make a signed-out browser render a name and a menu.
    expect(getStoredToken(ACCESS_TOKEN_KEY)).toBeNull();
    expect(getStoredToken(REFRESH_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('returns null rather than throwing when nothing is stored', () => {
    expect(getStoredToken(ACCESS_TOKEN_KEY)).toBeNull();
  });
});

describe('apiErrorMessage', () => {
  function axiosError(data: unknown): AxiosError {
    return { response: { data } } as AxiosError;
  }

  it('prefers the API message, because the backend writes them for people', () => {
    const error = axiosError({
      message: 'O canal "Chip Principal" está DEGRADED e não pode enviar.',
    });

    // Replacing this with a generic string would discard the only actionable part.
    expect(apiErrorMessage(error)).toContain('Chip Principal');
  });

  it('joins the array a validation error arrives as', () => {
    const error = axiosError({ message: ['Tag inválida.', 'content_hash inválido.'] });

    expect(apiErrorMessage(error)).toBe('Tag inválida. content_hash inválido.');
  });

  it('falls back when there is no message at all', () => {
    expect(apiErrorMessage(axiosError({}), 'Falha ao salvar.')).toBe('Falha ao salvar.');
    expect(apiErrorMessage(new Error('erro de rede'), 'Falha ao salvar.')).toBe('Falha ao salvar.');
    expect(apiErrorMessage(undefined)).toBe('Não foi possível concluir a ação.');
  });

  it('never leaks a 500 body as if it were advice', () => {
    // The backend answers 500 with a deliberately generic message; showing it verbatim is correct
    // precisely because it says nothing about internals.
    const error = axiosError({ statusCode: 500, message: 'Erro interno. Tente novamente.' });

    expect(apiErrorMessage(error)).toBe('Erro interno. Tente novamente.');
  });
});
