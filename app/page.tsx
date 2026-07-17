import { redirect } from 'next/navigation';
import { currentShopId } from '@/lib/session';

/** Entry point: logged-in shops land on Home, everyone else on login. */
export default function Root() {
  redirect(currentShopId() ? '/home' : '/login');
}
