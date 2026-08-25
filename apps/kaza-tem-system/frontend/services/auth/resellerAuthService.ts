import { authService } from './authService';

export const resellerAuthService = {
  login: authService.login,
  refresh: authService.refresh,
  me: authService.me,
};
