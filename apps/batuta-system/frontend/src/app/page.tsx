import { redirect } from 'next/navigation';

/**
 * The root sends people where the work is.
 *
 * The dashboard's own layout bounces to /login when there is no session, so this needs no auth check —
 * and doing one here would mean reading localStorage on the server, which is not possible anyway.
 */
export default function HomePage() {
  redirect('/dashboard');
}
