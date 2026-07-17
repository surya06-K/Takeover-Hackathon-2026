import { redirect } from 'next/navigation';

/** The digitizer grew into the khata app — scanning now lives at /scan. */
export default function DigitizeRedirect() {
  redirect('/scan');
}
