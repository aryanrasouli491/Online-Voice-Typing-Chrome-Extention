const $ = (selector) => document.querySelector(selector);
const PAGE_TEXT = {
  en: {
    eyebrow: "ONE-TIME SETUP",
    title: "Allow microphone access",
    intro: "Chrome does not reliably show microphone permission prompts inside an extension side panel. This page opens the permission flow in a normal tab.",
    status: "Your microphone has not been accessed yet.",
    requestButton: "Enable Microphone",
    settingsButton: "Open Chrome Microphone Settings",
    closeButton: "Close this tab and return to Online Voice Typing",
    privacy: "This step only checks microphone permission. It does not start a recording or upload audio to Groq, Gemini, OpenRouter, or any other service.",
    footer: "After allowing access, return to the Online Voice Typing side panel and click Start Recording.",
    grantedTitle: "Microphone access is allowed",
    grantedText: "Permission was granted successfully. No recording was started and no audio was uploaded.",
    blockedTitle: "Chrome has blocked microphone access",
    blockedText: "Chrome remembers a blocked permission and will not show the prompt again until you change it. Open Chrome settings and allow the microphone for Online Voice Typing.",
    dismissedTitle: "Chrome did not grant microphone access",
    dismissedText: "The request was dismissed or blocked by browser settings. Try again, or open Chrome microphone settings and allow access.",
    noDevice: "No microphone was found. Connect a microphone and try again.",
    failed: "Microphone access could not be started in this tab. Check Chrome and operating-system microphone settings, then try again.",
    working: "Waiting for Chrome microphone permission…",
    openSettingsFailed: "Chrome settings could not be opened automatically. Open chrome://settings/content/microphone manually.",
    settingsOpened: "Chrome microphone settings opened in another tab.",
    stateUnknown: "If Chrome shows a prompt, choose Allow. Permission is separate from permission to send audio online."
  },
  fa: {
    eyebrow: "تنظیم یک‌باره",
    title: "اجازهٔ دسترسی به میکروفون",
    intro: "Chrome ممکن است درخواست اجازهٔ میکروفون را در پنل کناری افزونه نمایش ندهد. این صفحه روند اجازه را در یک زبانهٔ عادی باز می‌کند.",
    status: "هنوز به میکروفون دسترسی گرفته نشده است.",
    requestButton: "فعال‌سازی میکروفون",
    settingsButton: "بازکردن تنظیمات میکروفون Chrome",
    closeButton: "بستن این زبانه و بازگشت به Online Voice Typing",
    privacy: "این مرحله فقط اجازهٔ میکروفون را بررسی می‌کند. ضبط آغاز نمی‌شود و صدا به Groq، Gemini، OpenRouter یا هیچ سرویس دیگری فرستاده نمی‌شود.",
    footer: "پس از اجازه‌دادن، به پنل Online Voice Typing برگردید و روی شروع ضبط کلیک کنید.",
    grantedTitle: "اجازهٔ میکروفون داده شد",
    grantedText: "اجازه با موفقیت داده شد. ضبط آغاز نشده و هیچ صدایی آپلود نشده است.",
    blockedTitle: "Chrome دسترسی میکروفون را مسدود کرده است",
    blockedText: "Chrome اجازهٔ مسدودشده را به خاطر سپرده و تا زمان تغییر تنظیمات دوباره درخواست نمی‌کند. تنظیمات Chrome را باز کنید و اجازهٔ میکروفون را برای Online Voice Typing فعال سازید.",
    dismissedTitle: "اجازهٔ میکروفون داده نشد",
    dismissedText: "درخواست بسته یا توسط تنظیمات مرورگر مسدود شد. دوباره تلاش کنید یا تنظیمات میکروفون Chrome را باز کرده و اجازه دهید.",
    noDevice: "هیچ میکروفونی پیدا نشد. میکروفون را وصل کرده و دوباره تلاش کنید.",
    failed: "دسترسی به میکروفون در این زبانه آغاز نشد. تنظیمات میکروفون Chrome و سیستم‌عامل را بررسی کنید.",
    working: "در انتظار اجازهٔ میکروفون از Chrome…",
    openSettingsFailed: "تنظیمات Chrome خودکار باز نشد. به‌صورت دستی آدرس chrome://settings/content/microphone را باز کنید.",
    settingsOpened: "تنظیمات میکروفون Chrome در زبانه‌ای دیگر باز شد.",
    stateUnknown: "اگر Chrome درخواست اجازه نشان داد، گزینهٔ اجازه را انتخاب کنید. اجازهٔ میکروفون با اجازهٔ ارسال آنلاین صدا فرق دارد."
  },
  ps: {
    eyebrow: "یو ځل تنظیم",
    title: "مایکروفون ته اجازه ورکړئ",
    intro: "Chrome ممکن د مایکروفون اجازه د غاړې په پینل کې ښکاره نه کړي. دا پاڼه د اجازه غوښتنه په عادي ټب کې پرانیزي.",
    status: "تر اوسه مایکروفون نه دی کارول شوی.",
    requestButton: "مایکروفون فعال کړئ",
    settingsButton: "د Chrome د مایکروفون تنظیمات پرانیزئ",
    closeButton: "دا ټب بند او Online Voice Typing ته بېرته لاړ شئ",
    privacy: "دا ګام یوازې د مایکروفون اجازه ازمويي. ثبت نه پیلوي او غږ هېڅ خدمت ته نه لېږي.",
    footer: "له اجازې وروسته د Online Voice Typing پینل ته بېرته لاړ شئ او Start Recording ووهئ.",
    grantedTitle: "مایکروفون ته اجازه ورکړل شوه",
    grantedText: "اجازه په بریالیتوب ورکړل شوه. ثبت نه دی پیل شوی او غږ نه دی لېږل شوی.",
    blockedTitle: "Chrome د مایکروفون اجازه بنده کړې",
    blockedText: "Chrome بنده شوې اجازه په یاد ساتي. د Chrome تنظیمات پرانیزئ او د Online Voice Typing لپاره د مایکروفون اجازه فعاله کړئ.",
    dismissedTitle: "د مایکروفون اجازه ترلاسه نه شوه",
    dismissedText: "غوښتنه بنده یا د براوزر د تنظیماتو له خوا محدوده شوه. بیا هڅه وکړئ یا د Chrome د مایکروفون تنظیمات پرانیزئ.",
    noDevice: "مایکروفون ونه موندل شو. مایکروفون وصل کړئ او بیا هڅه وکړئ.",
    failed: "په دې ټب کې مایکروفون فعال نه شو. د Chrome او عملیاتي سیستم تنظیمات وګورئ.",
    working: "د Chrome د مایکروفون اجازې ته انتظار…",
    openSettingsFailed: "د Chrome تنظیمات په خپله نه شول پرانیستلای. chrome://settings/content/microphone په لاس پرانیزئ.",
    settingsOpened: "د Chrome د مایکروفون تنظیمات په بل ټب کې پرانیستل شول.",
    stateUnknown: "که Chrome اجازه وغواړي، Allow وټاکئ. د مایکروفون اجازه د غږ آنلاین لېږلو اجازه نه ده."
  },
  ar: {
    eyebrow: "إعداد لمرة واحدة",
    title: "السماح بالوصول إلى الميكروفون",
    intro: "قد لا يعرض Chrome طلب إذن الميكروفون داخل اللوحة الجانبية. تفتح هذه الصفحة الطلب في علامة تبويب عادية.",
    status: "لم يتم الوصول إلى الميكروفون بعد.",
    requestButton: "تفعيل الميكروفون",
    settingsButton: "فتح إعدادات ميكروفون Chrome",
    closeButton: "إغلاق علامة التبويب والعودة إلى Online Voice Typing",
    privacy: "تتحقق هذه الخطوة من إذن الميكروفون فقط. لا تبدأ التسجيل ولا ترسل الصوت إلى أي خدمة.",
    footer: "بعد السماح، ارجع إلى لوحة Online Voice Typing واضغط على Start Recording.",
    grantedTitle: "تم السماح بالميكروفون",
    grantedText: "تم منح الإذن بنجاح. لم يبدأ التسجيل ولم يتم رفع أي صوت.",
    blockedTitle: "حظر Chrome الوصول إلى الميكروفون",
    blockedText: "يتذكر Chrome الإذن المحظور. افتح إعدادات Chrome واسمح للميكروفون في Online Voice Typing.",
    dismissedTitle: "لم يتم منح إذن الميكروفون",
    dismissedText: "تم إغلاق الطلب أو منعه من إعدادات المتصفح. حاول مرة أخرى أو افتح إعدادات الميكروفون.",
    noDevice: "لم يتم العثور على ميكروفون. وصّل ميكروفونًا ثم حاول مرة أخرى.",
    failed: "تعذر بدء الوصول إلى الميكروفون. تحقق من إعدادات Chrome والنظام.",
    working: "بانتظار إذن الميكروفون من Chrome…",
    openSettingsFailed: "تعذر فتح إعدادات Chrome تلقائيًا. افتح chrome://settings/content/microphone يدويًا.",
    settingsOpened: "تم فتح إعدادات ميكروفون Chrome في علامة تبويب أخرى.",
    stateUnknown: "إذا عرض Chrome طلب إذن، اختر Allow. إذن الميكروفون منفصل عن إذن إرسال الصوت عبر الإنترنت."
  },
  ur: {
    eyebrow: "ایک بار کی ترتیب",
    title: "مائیکروفون تک رسائی کی اجازت دیں",
    intro: "Chrome سائیڈ پینل میں مائیکروفون کی اجازت کا پیغام نہ دکھائے تو یہ صفحہ اسے عام ٹیب میں کھولتا ہے۔",
    status: "ابھی تک مائیکروفون تک رسائی نہیں ہوئی۔",
    requestButton: "مائیکروفون فعال کریں",
    settingsButton: "Chrome مائیکروفون کی ترتیبات کھولیں",
    closeButton: "یہ ٹیب بند کرکے Online Voice Typing پر واپس جائیں",
    privacy: "یہ مرحلہ صرف مائیکروفون کی اجازت چیک کرتا ہے۔ ریکارڈنگ شروع نہیں ہوتی اور آواز کسی سروس کو نہیں بھیجی جاتی۔",
    footer: "اجازت دینے کے بعد Online Voice Typing پینل پر واپس جا کر Start Recording دبائیں۔",
    grantedTitle: "مائیکروفون کی اجازت مل گئی",
    grantedText: "اجازت کامیابی سے مل گئی۔ ریکارڈنگ شروع نہیں ہوئی اور کوئی آڈیو اپ لوڈ نہیں ہوئی۔",
    blockedTitle: "Chrome نے مائیکروفون روک دیا ہے",
    blockedText: "Chrome مسدود اجازت یاد رکھتا ہے۔ Chrome ترتیبات کھولیں اور Online Voice Typing کے لیے مائیکروفون کی اجازت دیں۔",
    dismissedTitle: "مائیکروفون کی اجازت نہیں ملی",
    dismissedText: "درخواست بند ہو گئی یا براؤزر نے روک دی۔ دوبارہ کوشش کریں یا Chrome مائیکروفون ترتیبات کھولیں۔",
    noDevice: "کوئی مائیکروفون نہیں ملا۔ مائیکروفون جوڑ کر دوبارہ کوشش کریں۔",
    failed: "اس ٹیب میں مائیکروفون شروع نہیں ہو سکا۔ Chrome اور آپریٹنگ سسٹم کی ترتیبات چیک کریں۔",
    working: "Chrome کی مائیکروفون اجازت کا انتظار ہے…",
    openSettingsFailed: "Chrome ترتیبات خودکار طور پر نہیں کھل سکیں۔ chrome://settings/content/microphone دستی طور پر کھولیں۔",
    settingsOpened: "Chrome مائیکروفون ترتیبات دوسرے ٹیب میں کھل گئیں۔",
    stateUnknown: "اگر Chrome اجازت مانگے تو Allow منتخب کریں۔ مائیکروفون کی اجازت آن لائن آڈیو بھیجنے کی اجازت نہیں ہے۔"
  }
};

let language = "en";
let theme = "dark";
let requestInProgress = false;

function setStatus(message, kind = "") {
  const status = $("#permissionStatus");
  status.textContent = message;
  status.classList.toggle("is-success", kind === "success");
  status.classList.toggle("is-error", kind === "error");
}

function applyPageText() {
  const strings = PAGE_TEXT[language] || PAGE_TEXT.en;
  const languageTags = { fa: "fa-AF", ps: "ps-AF", ar: "ar", ur: "ur" };
  const rtlLanguages = ["fa", "ps", "ar", "ur"];
  document.documentElement.lang = languageTags[language] || "en";
  document.documentElement.dir = rtlLanguages.includes(language) ? "rtl" : "ltr";
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-page-i18n]").forEach((element) => {
    const key = element.dataset.pageI18n;
    if (strings[key]) element.textContent = strings[key];
  });
  const titles = {
    fa: "Online Voice Typing — اجازهٔ میکروفون",
    ps: "Online Voice Typing — د مایکروفون اجازه",
    ar: "Online Voice Typing — إذن الميكروفون",
    ur: "Online Voice Typing — مائیکروفون کی اجازت"
  };
  document.title = titles[language] || "Online Voice Typing — Microphone Permission";
}

async function getPermissionState() {
  try {
    if (!navigator.permissions?.query) return "unknown";
    return (await navigator.permissions.query({ name: "microphone" })).state;
  } catch {
    return "unknown";
  }
}

function showGranted() {
  const strings = PAGE_TEXT[language] || PAGE_TEXT.en;
  $("#permissionTitle").textContent = strings.grantedTitle;
  $("#permissionDescription").textContent = strings.grantedText;
  setStatus(strings.grantedText, "success");
  $("#requestPermissionButton").hidden = true;
  $("#openSettingsButton").hidden = true;
  $("#closePermissionTabButton").hidden = false;
}

function showBlocked() {
  const strings = PAGE_TEXT[language] || PAGE_TEXT.en;
  $("#permissionTitle").textContent = strings.blockedTitle;
  $("#permissionDescription").textContent = strings.blockedText;
  setStatus(strings.blockedText, "error");
  $("#requestPermissionButton").hidden = true;
  $("#openSettingsButton").hidden = false;
  $("#closePermissionTabButton").hidden = false;
  chrome.runtime.sendMessage({ type: "VOICEFLOW_MIC_PERMISSION_BLOCKED" }).catch(() => {});
}

async function refreshPermissionState() {
  const state = await getPermissionState();
  if (state === "granted") {
    showGranted();
  } else if (state === "denied") {
    showBlocked();
  }
}

async function requestPermission() {
  if (requestInProgress) return;
  requestInProgress = true;
  const strings = PAGE_TEXT[language] || PAGE_TEXT.en;
  const button = $("#requestPermissionButton");
  button.disabled = true;
  setStatus(strings.working);

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia is unavailable in this browser context.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    showGranted();
    chrome.runtime.sendMessage({ type: "VOICEFLOW_MIC_PERMISSION_GRANTED" }).catch(() => {});
  } catch (error) {
    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
      setStatus(strings.noDevice, "error");
      $("#permissionDescription").textContent = strings.noDevice;
      button.hidden = false;
    } else {
      const state = await getPermissionState();
      if (state === "denied") {
        showBlocked();
      } else {
        $("#permissionTitle").textContent = strings.dismissedTitle;
        $("#permissionDescription").textContent = strings.dismissedText;
        setStatus(strings.dismissedText, "error");
        $("#openSettingsButton").hidden = false;
        button.hidden = false;
      }
    }
  } finally {
    requestInProgress = false;
    button.disabled = false;
  }
}

async function openChromeMicrophoneSettings() {
  const strings = PAGE_TEXT[language] || PAGE_TEXT.en;
  const settingsUrl = `chrome://settings/content/siteDetails?site=${encodeURIComponent(`chrome-extension://${chrome.runtime.id}`)}`;
  try {
    await chrome.tabs.create({ url: settingsUrl, active: true });
    setStatus(strings.settingsOpened);
  } catch {
    setStatus(strings.openSettingsFailed, "error");
  }
}

async function closeCurrentTab() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) {
      await chrome.tabs.remove(tab.id);
      return;
    }
  } catch {
    // Fall back to the browser's normal tab controls.
  }
  window.close();
}

async function initialize() {
  // Settings are stored together by the side panel. Reading the same object keeps
  // the permission tab in the user's chosen interface language and theme.
  const saved = await chrome.storage.local.get("voiceFlowSettings");
  const settings = saved.voiceFlowSettings && typeof saved.voiceFlowSettings === "object"
    ? saved.voiceFlowSettings
    : {};
  const supportedLanguages = ["en", "fa", "ps", "ar", "ur"];
  language = supportedLanguages.includes(settings.interfaceLanguage) ? settings.interfaceLanguage : "en";
  theme = settings.theme === "light" ? "light" : "dark";
  applyPageText();
  $("#requestPermissionButton").addEventListener("click", requestPermission);
  $("#openSettingsButton").addEventListener("click", openChromeMicrophoneSettings);
  $("#closePermissionTabButton").addEventListener("click", closeCurrentTab);

  const blockedByQuery = new URLSearchParams(location.search).get("blocked") === "1";
  const state = await getPermissionState();
  if (state === "granted") showGranted();
  else if (state === "denied" || blockedByQuery) showBlocked();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshPermissionState().catch(() => {});
  });
  window.addEventListener("focus", () => refreshPermissionState().catch(() => {}));
  try {
    const permission = await navigator.permissions.query({ name: "microphone" });
    permission.onchange = () => refreshPermissionState().catch(() => {});
  } catch {
    // The browser may not expose microphone permission state.
  }
}

initialize().catch(() => {
  const strings = PAGE_TEXT[language] || PAGE_TEXT.en;
  setStatus(strings.failed, "error");
});
