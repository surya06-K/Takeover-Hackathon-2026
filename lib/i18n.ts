/** UI strings for low-literacy / Hindi-first shopkeepers. */

export type UILocale = 'en' | 'hi';

export const UI_STRINGS = {
  en: {
    // nav
    navHome: 'Home',
    navUdhaar: 'Udhaar',
    navScan: 'Scan',
    navSales: 'Sales',
    navStock: 'Stock',
    navScanAria: 'Scan a register page',

    // home
    namaste: 'Namaste',
    ji: 'ji',
    outstanding: 'Outstanding',
    parties: 'parties',
    party: 'party',
    flaggedDue: '₹5,000+ due',
    topDebtor: 'top',
    nobodyFlagged: 'nobody flagged',
    collectToday: 'Collect today',
    entries: 'entries',
    entry: 'entry',
    recentActivity: 'Recent activity',
    emptyHome: 'Nothing yet — tap Scan below and photograph your first register page.',
    demoStorage: 'demo storage',
    dbConnected: 'DB connected',

    // udhaar
    udhaarKhata: 'Udhaar khata',
    toCollect: 'to collect',
    loading: 'loading…',
    searchPlaceholder: 'Search name or phone number…',
    searchAria: 'Search parties by name or phone',
    noSearchMatch: 'No party matches that search.',
    noParties: 'No parties yet — scan a register page or add entries from a party profile.',
    noPhone: 'no phone saved',
    due: 'due',
    settled: 'settled',
    advance: 'advance',
    exportCsv: 'Export CSV',
    exportJson: 'Export JSON',

    // party
    balanceDue: 'Balance due',
    advanceHeld: 'Advance held',
    autoUpdated: 'auto-updated',
    udhaarDiya: 'Udhaar diya',
    paymentAaya: 'Payment aaya',
    udhaarAmount: 'Udhaar amount (₹)',
    paymentReceived: 'Payment received (₹)',
    itemNote: 'Item / note (optional)',
    saveEntry: 'Save entry',
    cancel: 'Cancel',
    call: 'Call',
    timeline: 'Timeline',
    noEntries: 'No entries yet.',
    credit: 'Credit',
    payment: 'Payment',
    asWritten: 'as written',
    backToUdhaar: 'Back to Udhaar',
    openingKhata: 'Opening khata…',

    // accessibility
    speak: 'Listen',
    speakStop: 'Stop',
    voiceSearch: 'Speak to search',
    voiceAmount: 'Speak amount',
    langToggle: 'Language',
    voiceHelp: 'Voice help',
    voiceHelpOn: 'Voice help on',
    voiceHelpOff: 'Voice help off',
    largeText: 'Large text',
    largeTextOn: 'Large text on',
    largeTextOff: 'Large text off',
    help: 'Help',
    helpClose: 'Close help',

    // onboarding
    onboardingTitle: 'How KaagazAI works',
    onboardingStep1Title: 'Take a photo',
    onboardingStep1Desc: 'Tap the camera button and photograph your handwritten register page.',
    onboardingStep2Title: 'Check the rows',
    onboardingStep2Desc: 'Compare with your paper. Tap the speaker icon to hear each row read aloud.',
    onboardingStep3Title: 'Save to khata',
    onboardingStep3Desc: 'After saving, see who owes how much. Tap any name to call or add payment.',
    onboardingGotIt: 'Got it, start using',
    onboardingSkip: 'Skip',

    // spoken help per page
    helpHome: 'This is your home screen. It shows total money to collect and who to call today. Tap the camera at the bottom to scan your register.',
    helpUdhaar: 'This is your udhaar list. Everyone who owes you money is here. Tap a name to see details. Use the microphone to search by speaking a name.',
    helpScan: 'Take a photo of your register page. The app will read your handwriting. Check each row and save.',
    helpParty: 'This person\'s khata. Green button means you gave credit. White button means payment came. Tap the speaker to hear the balance.',
    helpSales: 'Your sales register. Scan a bill book page to fill this.',
    helpStock: 'Your stock register. Scan a stock page to see items in and out.',

    // audio feedback labels
    saved: 'Saved successfully',
    errorGeneric: 'Something went wrong',
  },
  hi: {
    navHome: 'घर',
    navUdhaar: 'उधार',
    navScan: 'स्कैन',
    navSales: 'बिक्री',
    navStock: 'स्टॉक',
    navScanAria: 'रजिस्टर का फोटो लें',

    namaste: 'नमस्ते',
    ji: 'जी',
    outstanding: 'कुल बाकी',
    parties: 'ग्राहक',
    party: 'ग्राहक',
    flaggedDue: '₹5,000+ बाकी',
    topDebtor: 'सबसे ज़्यादा',
    nobodyFlagged: 'कोई नहीं',
    collectToday: 'आज वसूल करें',
    entries: 'एंट्री',
    entry: 'एंट्री',
    recentActivity: 'हाल की गतिविधि',
    emptyHome: 'अभी कुछ नहीं — नीचे स्कैन दबाएँ और अपने रजिस्टर का पहला फोटो लें।',
    demoStorage: 'डेमो स्टोरेज',
    dbConnected: 'डेटाबेस जुड़ा',

    udhaarKhata: 'उधार खाता',
    toCollect: 'वसूल करना है',
    loading: 'लोड हो रहा…',
    searchPlaceholder: 'नाम या फोन नंबर खोजें…',
    searchAria: 'नाम या फोन से खोजें',
    noSearchMatch: 'कोई ग्राहक नहीं मिला।',
    noParties: 'अभी कोई ग्राहक नहीं — रजिस्टर स्कैन करें या ग्राहक से एंट्री जोड़ें।',
    noPhone: 'फोन नहीं है',
    due: 'बाकी',
    settled: 'चुकता',
    advance: 'एडवांस',
    exportCsv: 'CSV डाउनलोड',
    exportJson: 'JSON डाउनलोड',

    balanceDue: 'बाकी रकम',
    advanceHeld: 'एडवांस रखा',
    autoUpdated: 'अपने आप अपडेट',
    udhaarDiya: '+ उधार दिया',
    paymentAaya: '₹ पेमेंट आया',
    udhaarAmount: 'उधार की रकम (₹)',
    paymentReceived: 'पेमेंट मिली (₹)',
    itemNote: 'सामान / नोट (वैकल्पिक)',
    saveEntry: 'सेव करें',
    cancel: 'रद्द',
    call: 'कॉल',
    timeline: 'इतिहास',
    noEntries: 'अभी कोई एंट्री नहीं।',
    credit: 'उधार',
    payment: 'पेमेंट',
    asWritten: 'जैसा लिखा',
    backToUdhaar: 'उधार पर वापस',
    openingKhata: 'खाता खोल रहे…',

    speak: 'सुनें',
    speakStop: 'रोकें',
    voiceSearch: 'बोलकर खोजें',
    voiceAmount: 'रकम बोलें',
    langToggle: 'भाषा',
    voiceHelp: 'आवाज़ सहायता',
    voiceHelpOn: 'आवाज़ चालू',
    voiceHelpOff: 'आवाज़ बंद',
    largeText: 'बड़ा अक्षर',
    largeTextOn: 'बड़ा अक्षर चालू',
    largeTextOff: 'बड़ा अक्षर बंद',
    help: 'मदद',
    helpClose: 'बंद करें',

    onboardingTitle: 'KaagazAI कैसे चलाएँ',
    onboardingStep1Title: 'फोटो लें',
    onboardingStep1Desc: 'नीचे कैमरा बटन दबाएँ और अपने हाथ से लिखे रजिस्टर का फोटो लें।',
    onboardingStep2Title: 'पंक्तियाँ देखें',
    onboardingStep2Desc: 'अपने कागज़ से मिलाएँ। स्पीकर दबाकर हर पंक्ति सुन सकते हैं।',
    onboardingStep3Title: 'खाते में सेव करें',
    onboardingStep3Desc: 'सेव के बाद देखें किससे कितना लेना है। नाम दबाकर कॉल या पेमेंट जोड़ें।',
    onboardingGotIt: 'समझ गया, शुरू करें',
    onboardingSkip: 'छोड़ें',

    helpHome: 'यह आपकी होम स्क्रीन है। कुल बाकी रकम और आज किससे वसूल करना है, यह दिखता है। नीचे कैमरा दबाकर रजिस्टर स्कैन करें।',
    helpUdhaar: 'यह उधार की सूची है। जिनसे पैसे लेने हैं, वे यहाँ हैं। नाम दबाकर विवरण देखें। माइक से नाम बोलकर खोजें।',
    helpScan: 'रजिस्टर का फोटो लें। ऐप आपकी लिखावट पढ़ेगा। हर पंक्ति देखकर सेव करें।',
    helpParty: 'इस व्यक्ति का खाता। हरा बटन उधार देने के लिए। सफेद बटन पेमेंट आने पर। स्पीकर दबाकर बाकी रकम सुनें।',
    helpSales: 'आपकी बिक्री की सूची। बिल बुक का फोटो स्कैन करें।',
    helpStock: 'आपका स्टॉक रजिस्टर। स्टॉक पेज स्कैन करें।',

    saved: 'सेव हो गया',
    errorGeneric: 'कुछ गलत हो गया',
  },
} as const;

export type UIStringKey = keyof typeof UI_STRINGS.en;

export function t(locale: UILocale, key: UIStringKey): string {
  return UI_STRINGS[locale][key];
}

/** Speak-friendly rupee amount in Hindi/English. */
export function speakAmount(amount: number, locale: UILocale): string {
  const abs = Math.abs(Math.round(amount));
  if (locale === 'hi') {
    if (abs === 0) return 'शून्य रुपये';
    return `${numberToHindiWords(abs)} रुपये`;
  }
  return `${abs.toLocaleString('en-IN')} rupees`;
}

/** Convert integer to Hindi words (up to lakhs — enough for shop ledgers). */
function numberToHindiWords(n: number): string {
  if (n === 0) return 'शून्य';
  const ones = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'];
  const teens = ['दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस'];
  const tens = ['', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे'];

  function below100(x: number): string {
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10);
    const o = x % 10;
    return o ? `${tens[t]} ${ones[o]}` : tens[t];
  }

  function below1000(x: number): string {
    if (x < 100) return below100(x);
    const h = Math.floor(x / 100);
    const r = x % 100;
    return r ? `${ones[h]} सौ ${below100(r)}` : `${ones[h]} सौ`;
  }

  const parts: string[] = [];
  const lakh = Math.floor(n / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  if (lakh) parts.push(`${below1000(lakh)} लाख`);
  if (thousand) parts.push(`${below1000(thousand)} हज़ार`);
  if (rest) parts.push(below1000(rest));

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
