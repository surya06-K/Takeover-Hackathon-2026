import { redirect } from 'next/navigation';

/** The session ledger grew into the persistent Udhaar khata. */
export default function LedgerRedirect() {
  redirect('/udhaar');
}
