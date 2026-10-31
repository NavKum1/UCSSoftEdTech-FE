/**
 * The guidance form's own words (buttons, field names, messages) in every language a form can be offered in. The
 * institute's own texts are translated in the form editor. "{n}" is replaced with a number.
 */

export type UiKey =
  | "next" | "back" | "send" | "sending" | "optional" | "unsure" | "unsurePh" | "details" | "name" | "email" | "phone" | "step" | "of"
  | "minutes" | "other" | "otherPh" | "yes" | "no" | "choose" | "attach" | "uploading" | "remove" | "saveLater" | "welcomeBack" | "startOver" | "saved" | "copy" | "copied"
  | "thanks" | "language" | "fileHint" | "partialNotice"
  | "addRow" | "sliderHint" | "leansTo" | "middle" | "yourResults" | "yourResult" | "match" | "continue" | "done"
  | "topics" | "howMeet" | "pickDay" | "timeOfDay" | "morning" | "afternoon" | "evening" | "anyTime" | "pickTime" | "laterTimes" | "earlierTimes"
  | "noTimes" | "loadingTimes" | "Phone" | "Video" | "InPerson" | "meetingBooked" | "meetingAsked" | "meetingTaken" | "clearMeeting" | "timesIn"
  | "yourScore" | "share" | "shareText" | "seeReport" | "allAnswers" | "yourStyle" | "noAnswersKept" | "privateNote" | "sent" | "downloadPdf";

/** English has every text; other languages fall back to it for texts not yet translated */
export const UI: { en: Record<UiKey, string> } & Record<string, Partial<Record<UiKey, string>>> = {
  en: {
    next: "Next", back: "Back", send: "Send", sending: "Sending…", optional: "optional", unsure: "What are you unsure about?",
    unsurePh: "e.g. I can't decide between cloud and data, or which certification would help me get a job", details: "Your details", name: "Name",
    email: "Email", phone: "Phone", step: "Step", of: "of", minutes: "About {n} min", other: "Other", otherPh: "Please specify", yes: "Yes", no: "No",
    choose: "Choose…", attach: "Attach a file", uploading: "Uploading…", remove: "Remove", saveLater: "Save and finish later", welcomeBack: "Welcome back. Your answers so far are kept in this browser.", startOver: "Start over",
    saved: "Saved. Use this link to come back within 30 days:", copy: "Copy link", copied: "Copied", thanks: "Thank you. Your request was sent.",
    language: "Language", fileHint: "PDF, Word, JPG or PNG, up to 5 MB.",
    partialNotice: "We save your details as you go so {institute} can help you.",
    addRow: "Add another", sliderHint: "Move the slider to where you fit, or leave it in the middle.", leansTo: "Leans to “{x}”", middle: "In the middle",
    yourResults: "Your results", yourResult: "Your result", match: "Match", continue: "Continue", done: "Done",
    topics: "What would you like to talk about?", howMeet: "How would you like to meet?", pickDay: "Which day suits you?", timeOfDay: "What time of day?",
    morning: "Morning", afternoon: "Afternoon", evening: "Evening", anyTime: "Any time", pickTime: "Pick a time", laterTimes: "Later dates", earlierTimes: "Earlier dates",
    noTimes: "No free times in these two weeks.", loadingTimes: "Finding free times…", Phone: "Phone call", Video: "Video call", InPerson: "In person",
    meetingBooked: "Your meeting is booked for {when}. We've emailed you the details.",
    meetingAsked: "We've got your request for a meeting. We'll confirm the time by email.",
    meetingTaken: "That time was taken just before your request arrived, so we'll email you to agree another.",
    clearMeeting: "Clear", timesIn: "Times are in {tz}.",
    yourScore: "Your score", share: "Share", shareText: "I scored {n}% on {form}.", seeReport: "See your full report", allAnswers: "All your answers",
    yourStyle: "Your style is", noAnswersKept: "Your answers are no longer kept.", sent: "Sent {date}", downloadPdf: "Download PDF",
    privateNote: "This page is private to you. Anyone with the link can see it, so keep it to yourself. It stops working 180 days after you sent the form.",
  },
  hi: {
    next: "आगे", back: "पीछे", send: "भेजें", sending: "भेजा जा रहा है…", optional: "वैकल्पिक", unsure: "आप किस बारे में निश्चित नहीं हैं?",
    unsurePh: "जैसे: मैं क्लाउड और डेटा में से चुन नहीं पा रहा/रही हूँ", details: "आपकी जानकारी", name: "नाम", email: "ईमेल", phone: "फ़ोन",
    step: "चरण", of: "में से", minutes: "लगभग {n} मिनट", other: "अन्य", otherPh: "कृपया बताएं", yes: "हाँ", no: "नहीं", choose: "चुनें…",
    attach: "फ़ाइल जोड़ें", uploading: "अपलोड हो रहा है…", remove: "हटाएँ", saveLater: "सहेजें और बाद में पूरा करें", welcomeBack: "फिर से स्वागत है। आपके अब तक के जवाब इसी ब्राउज़र में सहेजे गए हैं।", startOver: "फिर से शुरू करें",
    saved: "सहेजा गया। 30 दिनों के भीतर लौटने के लिए यह लिंक इस्तेमाल करें:", copy: "लिंक कॉपी करें", copied: "कॉपी हो गया",
    thanks: "धन्यवाद। आपका अनुरोध भेज दिया गया है।", language: "भाषा", fileHint: "PDF, Word, JPG या PNG, 5 MB तक।",
    partialNotice: "हम आपकी जानकारी साथ-साथ सहेजते हैं ताकि {institute} आपकी मदद कर सके।",
    topics: "आप किस बारे में बात करना चाहेंगे?", howMeet: "आप कैसे मिलना चाहेंगे?", pickDay: "कौन सा दिन ठीक रहेगा?", timeOfDay: "दिन का कौन सा समय?",
    morning: "सुबह", afternoon: "दोपहर", evening: "शाम", anyTime: "कभी भी", pickTime: "समय चुनें", laterTimes: "आगे की तारीखें", earlierTimes: "पहले की तारीखें",
    noTimes: "इन दो हफ़्तों में कोई खाली समय नहीं है।", loadingTimes: "खाली समय देखे जा रहे हैं…", Phone: "फ़ोन कॉल", Video: "वीडियो कॉल", InPerson: "आमने-सामने",
    meetingBooked: "आपकी मीटिंग {when} के लिए बुक हो गई है। विवरण ईमेल कर दिया गया है।",
    meetingAsked: "मीटिंग का आपका अनुरोध मिल गया है। हम समय ईमेल से पक्का करेंगे।",
    meetingTaken: "आपका अनुरोध पहुँचने से ठीक पहले वह समय बुक हो गया, इसलिए हम दूसरा समय तय करने के लिए ईमेल करेंगे।",
    clearMeeting: "हटाएँ", timesIn: "समय {tz} के अनुसार है।",
  },
  bn: {
    next: "পরবর্তী", back: "পিছনে", send: "পাঠান", sending: "পাঠানো হচ্ছে…", optional: "ঐচ্ছিক", unsure: "আপনি কোন বিষয়ে নিশ্চিত নন?",
    unsurePh: "যেমন: আমি ক্লাউড আর ডেটার মধ্যে বেছে নিতে পারছি না", details: "আপনার তথ্য", name: "নাম", email: "ইমেল", phone: "ফোন",
    step: "ধাপ", of: "এর মধ্যে", minutes: "প্রায় {n} মিনিট", other: "অন্যান্য", otherPh: "অনুগ্রহ করে লিখুন", yes: "হ্যাঁ", no: "না", choose: "বেছে নিন…",
    attach: "ফাইল যোগ করুন", uploading: "আপলোড হচ্ছে…", remove: "সরান", saveLater: "সংরক্ষণ করে পরে শেষ করুন", welcomeBack: "আবার স্বাগতম। এখন পর্যন্ত আপনার উত্তরগুলো এই ব্রাউজারে রাখা আছে।", startOver: "আবার শুরু করুন",
    saved: "সংরক্ষিত। ৩০ দিনের মধ্যে ফিরে আসতে এই লিঙ্কটি ব্যবহার করুন:", copy: "লিঙ্ক কপি করুন", copied: "কপি হয়েছে",
    thanks: "ধন্যবাদ। আপনার অনুরোধ পাঠানো হয়েছে।", language: "ভাষা", fileHint: "PDF, Word, JPG বা PNG, সর্বোচ্চ 5 MB।",
    partialNotice: "আমরা আপনার তথ্য সঙ্গে সঙ্গে সংরক্ষণ করি, যাতে {institute} আপনাকে সাহায্য করতে পারে।",
  },
  ta: {
    next: "அடுத்து", back: "பின்செல்", send: "அனுப்பு", sending: "அனுப்பப்படுகிறது…", optional: "விருப்பத்தேர்வு", unsure: "எதைப் பற்றி உங்களுக்குத் தெளிவில்லை?",
    unsurePh: "எ.கா. கிளவுட், டேட்டா இவற்றில் எதைத் தேர்வு செய்வது என்று தெரியவில்லை", details: "உங்கள் விவரங்கள்", name: "பெயர்", email: "மின்னஞ்சல்", phone: "தொலைபேசி",
    step: "படி", of: "இல்", minutes: "சுமார் {n} நிமிடம்", other: "மற்றவை", otherPh: "குறிப்பிடவும்", yes: "ஆம்", no: "இல்லை", choose: "தேர்வு செய்யவும்…",
    attach: "கோப்பை இணைக்கவும்", uploading: "பதிவேற்றப்படுகிறது…", remove: "நீக்கு", saveLater: "சேமித்து பிறகு முடிக்கவும்", welcomeBack: "மீண்டும் வருக. இதுவரையிலான உங்கள் பதில்கள் இந்த உலாவியில் வைக்கப்பட்டுள்ளன.", startOver: "மீண்டும் தொடங்கவும்",
    saved: "சேமிக்கப்பட்டது. 30 நாட்களுக்குள் திரும்ப வர இந்த இணைப்பைப் பயன்படுத்தவும்:", copy: "இணைப்பை நகலெடு", copied: "நகலெடுக்கப்பட்டது",
    thanks: "நன்றி. உங்கள் கோரிக்கை அனுப்பப்பட்டது.", language: "மொழி", fileHint: "PDF, Word, JPG அல்லது PNG, 5 MB வரை.",
    partialNotice: "{institute} உங்களுக்கு உதவ, நீங்கள் நிரப்பும்போதே உங்கள் விவரங்களைச் சேமிக்கிறோம்.",
  },
  te: {
    next: "తదుపరి", back: "వెనుకకు", send: "పంపండి", sending: "పంపుతోంది…", optional: "ఐచ్ఛికం", unsure: "మీకు దేని గురించి స్పష్టత లేదు?",
    unsurePh: "ఉదా. క్లౌడ్, డేటా మధ్య ఏది ఎంచుకోవాలో తెలియడం లేదు", details: "మీ వివరాలు", name: "పేరు", email: "ఇమెయిల్", phone: "ఫోన్",
    step: "దశ", of: "లో", minutes: "సుమారు {n} నిమిషాలు", other: "ఇతర", otherPh: "దయచేసి తెలపండి", yes: "అవును", no: "కాదు", choose: "ఎంచుకోండి…",
    attach: "ఫైల్ జత చేయండి", uploading: "అప్‌లోడ్ అవుతోంది…", remove: "తీసివేయండి", saveLater: "సేవ్ చేసి తర్వాత పూర్తి చేయండి", welcomeBack: "తిరిగి స్వాగతం. ఇప్పటివరకు మీ సమాధానాలు ఈ బ్రౌజర్‌లో ఉంచబడ్డాయి.", startOver: "మళ్లీ మొదలుపెట్టండి",
    saved: "సేవ్ అయింది. 30 రోజుల్లో తిరిగి రావడానికి ఈ లింక్ వాడండి:", copy: "లింక్ కాపీ చేయండి", copied: "కాపీ అయింది",
    thanks: "ధన్యవాదాలు. మీ అభ్యర్థన పంపబడింది.", language: "భాష", fileHint: "PDF, Word, JPG లేదా PNG, 5 MB వరకు.",
    partialNotice: "{institute} మీకు సహాయం చేయడానికి, మీరు నింపుతున్నప్పుడే మీ వివరాలను సేవ్ చేస్తాము.",
  },
  mr: {
    next: "पुढे", back: "मागे", send: "पाठवा", sending: "पाठवत आहे…", optional: "ऐच्छिक", unsure: "तुम्हाला कशाबद्दल खात्री नाही?",
    unsurePh: "उदा. क्लाउड आणि डेटा यापैकी काय निवडावे ते ठरत नाही", details: "तुमची माहिती", name: "नाव", email: "ईमेल", phone: "फोन",
    step: "टप्पा", of: "पैकी", minutes: "सुमारे {n} मिनिटे", other: "इतर", otherPh: "कृपया सांगा", yes: "होय", no: "नाही", choose: "निवडा…",
    attach: "फाइल जोडा", uploading: "अपलोड होत आहे…", remove: "काढा", saveLater: "जतन करा आणि नंतर पूर्ण करा", welcomeBack: "पुन्हा स्वागत आहे. आतापर्यंतची तुमची उत्तरे या ब्राउझरमध्ये ठेवली आहेत.", startOver: "पुन्हा सुरू करा",
    saved: "जतन झाले. 30 दिवसांत परत येण्यासाठी ही लिंक वापरा:", copy: "लिंक कॉपी करा", copied: "कॉपी झाले",
    thanks: "धन्यवाद. तुमची विनंती पाठवली आहे.", language: "भाषा", fileHint: "PDF, Word, JPG किंवा PNG, 5 MB पर्यंत.",
    partialNotice: "{institute} तुम्हाला मदत करू शकेल म्हणून आम्ही तुमची माहिती भरताना जतन करतो.",
  },
  kn: {
    next: "ಮುಂದೆ", back: "ಹಿಂದೆ", send: "ಕಳುಹಿಸಿ", sending: "ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…", optional: "ಐಚ್ಛಿಕ", unsure: "ನಿಮಗೆ ಯಾವುದರ ಬಗ್ಗೆ ಖಚಿತತೆ ಇಲ್ಲ?",
    unsurePh: "ಉದಾ. ಕ್ಲೌಡ್ ಮತ್ತು ಡೇಟಾ ನಡುವೆ ಯಾವುದನ್ನು ಆರಿಸಬೇಕು ಎಂದು ತಿಳಿಯುತ್ತಿಲ್ಲ", details: "ನಿಮ್ಮ ವಿವರಗಳು", name: "ಹೆಸರು", email: "ಇಮೇಲ್", phone: "ಫೋನ್",
    step: "ಹಂತ", of: "ರಲ್ಲಿ", minutes: "ಸುಮಾರು {n} ನಿಮಿಷ", other: "ಇತರೆ", otherPh: "ದಯವಿಟ್ಟು ತಿಳಿಸಿ", yes: "ಹೌದು", no: "ಇಲ್ಲ", choose: "ಆಯ್ಕೆಮಾಡಿ…",
    attach: "ಫೈಲ್ ಲಗತ್ತಿಸಿ", uploading: "ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…", remove: "ತೆಗೆದುಹಾಕಿ", saveLater: "ಉಳಿಸಿ, ನಂತರ ಪೂರ್ಣಗೊಳಿಸಿ", welcomeBack: "ಮರಳಿ ಸ್ವಾಗತ. ಇಲ್ಲಿಯವರೆಗಿನ ನಿಮ್ಮ ಉತ್ತರಗಳನ್ನು ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಇರಿಸಲಾಗಿದೆ.", startOver: "ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ",
    saved: "ಉಳಿಸಲಾಗಿದೆ. 30 ದಿನಗಳಲ್ಲಿ ಹಿಂತಿರುಗಲು ಈ ಲಿಂಕ್ ಬಳಸಿ:", copy: "ಲಿಂಕ್ ನಕಲಿಸಿ", copied: "ನಕಲಿಸಲಾಗಿದೆ",
    thanks: "ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಲಾಗಿದೆ.", language: "ಭಾಷೆ", fileHint: "PDF, Word, JPG ಅಥವಾ PNG, 5 MB ವರೆಗೆ.",
    partialNotice: "{institute} ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು, ನೀವು ತುಂಬುತ್ತಿರುವಾಗಲೇ ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಉಳಿಸುತ್ತೇವೆ.",
  },
  ml: {
    next: "അടുത്തത്", back: "പിന്നോട്ട്", send: "അയയ്ക്കുക", sending: "അയയ്ക്കുന്നു…", optional: "ഐച്ഛികം", unsure: "എന്തിനെക്കുറിച്ചാണ് നിങ്ങൾക്ക് ഉറപ്പില്ലാത്തത്?",
    unsurePh: "ഉദാ. ക്ലൗഡോ ഡേറ്റയോ എന്ന് തീരുമാനിക്കാൻ കഴിയുന്നില്ല", details: "നിങ്ങളുടെ വിവരങ്ങൾ", name: "പേര്", email: "ഇമെയിൽ", phone: "ഫോൺ",
    step: "ഘട്ടം", of: "ൽ", minutes: "ഏകദേശം {n} മിനിറ്റ്", other: "മറ്റുള്ളവ", otherPh: "ദയവായി വ്യക്തമാക്കുക", yes: "അതെ", no: "ഇല്ല", choose: "തിരഞ്ഞെടുക്കുക…",
    attach: "ഫയൽ ചേർക്കുക", uploading: "അപ്‌ലോഡ് ചെയ്യുന്നു…", remove: "നീക്കം ചെയ്യുക", saveLater: "സേവ് ചെയ്ത് പിന്നീട് പൂർത്തിയാക്കുക", welcomeBack: "വീണ്ടും സ്വാഗതം. ഇതുവരെയുള്ള നിങ്ങളുടെ ഉത്തരങ്ങൾ ഈ ബ്രൗസറിൽ സൂക്ഷിച്ചിട്ടുണ്ട്.", startOver: "വീണ്ടും തുടങ്ങുക",
    saved: "സേവ് ചെയ്തു. 30 ദിവസത്തിനുള്ളിൽ തിരികെ വരാൻ ഈ ലിങ്ക് ഉപയോഗിക്കുക:", copy: "ലിങ്ക് പകർത്തുക", copied: "പകർത്തി",
    thanks: "നന്ദി. നിങ്ങളുടെ അഭ്യർത്ഥന അയച്ചു.", language: "ഭാഷ", fileHint: "PDF, Word, JPG അല്ലെങ്കിൽ PNG, 5 MB വരെ.",
    partialNotice: "{institute} നിങ്ങളെ സഹായിക്കാൻ, നിങ്ങൾ പൂരിപ്പിക്കുമ്പോൾ തന്നെ നിങ്ങളുടെ വിവരങ്ങൾ ഞങ്ങൾ സൂക്ഷിക്കുന്നു.",
  },
  gu: {
    next: "આગળ", back: "પાછળ", send: "મોકલો", sending: "મોકલી રહ્યા છીએ…", optional: "વૈકલ્પિક", unsure: "તમને શેના વિશે ખાતરી નથી?",
    unsurePh: "દા.ત. ક્લાઉડ અને ડેટામાંથી શું પસંદ કરવું તે નક્કી કરી શકતો/શકતી નથી", details: "તમારી વિગતો", name: "નામ", email: "ઇમેઇલ", phone: "ફોન",
    step: "પગલું", of: "માંથી", minutes: "લગભગ {n} મિનિટ", other: "અન્ય", otherPh: "કૃપા કરી જણાવો", yes: "હા", no: "ના", choose: "પસંદ કરો…",
    attach: "ફાઇલ જોડો", uploading: "અપલોડ થઈ રહ્યું છે…", remove: "દૂર કરો", saveLater: "સાચવો અને પછી પૂરું કરો", welcomeBack: "ફરી સ્વાગત છે. અત્યાર સુધીના તમારા જવાબો આ બ્રાઉઝરમાં રાખ્યા છે.", startOver: "ફરી શરૂ કરો",
    saved: "સાચવ્યું. 30 દિવસમાં પાછા આવવા આ લિંક વાપરો:", copy: "લિંક કૉપિ કરો", copied: "કૉપિ થયું",
    thanks: "આભાર. તમારી વિનંતી મોકલાઈ ગઈ છે.", language: "ભાષા", fileHint: "PDF, Word, JPG અથવા PNG, 5 MB સુધી.",
    partialNotice: "{institute} તમારી મદદ કરી શકે તે માટે અમે તમારી વિગતો ભરતાં ભરતાં સાચવીએ છીએ.",
  },
  pa: {
    next: "ਅੱਗੇ", back: "ਪਿੱਛੇ", send: "ਭੇਜੋ", sending: "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…", optional: "ਵਿਕਲਪਿਕ", unsure: "ਤੁਹਾਨੂੰ ਕਿਸ ਬਾਰੇ ਯਕੀਨ ਨਹੀਂ?",
    unsurePh: "ਜਿਵੇਂ: ਮੈਂ ਕਲਾਊਡ ਅਤੇ ਡਾਟਾ ਵਿੱਚੋਂ ਚੁਣ ਨਹੀਂ ਪਾ ਰਿਹਾ/ਰਹੀ", details: "ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ", name: "ਨਾਮ", email: "ਈਮੇਲ", phone: "ਫ਼ੋਨ",
    step: "ਕਦਮ", of: "ਵਿੱਚੋਂ", minutes: "ਲਗਭਗ {n} ਮਿੰਟ", other: "ਹੋਰ", otherPh: "ਕਿਰਪਾ ਕਰਕੇ ਦੱਸੋ", yes: "ਹਾਂ", no: "ਨਹੀਂ", choose: "ਚੁਣੋ…",
    attach: "ਫ਼ਾਈਲ ਜੋੜੋ", uploading: "ਅੱਪਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", remove: "ਹਟਾਓ", saveLater: "ਸੰਭਾਲੋ ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਪੂਰਾ ਕਰੋ", welcomeBack: "ਫਿਰ ਤੋਂ ਜੀ ਆਇਆਂ ਨੂੰ। ਹੁਣ ਤੱਕ ਦੇ ਤੁਹਾਡੇ ਜਵਾਬ ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਰੱਖੇ ਗਏ ਹਨ।", startOver: "ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ",
    saved: "ਸੰਭਾਲਿਆ ਗਿਆ। 30 ਦਿਨਾਂ ਵਿੱਚ ਵਾਪਸ ਆਉਣ ਲਈ ਇਹ ਲਿੰਕ ਵਰਤੋ:", copy: "ਲਿੰਕ ਕਾਪੀ ਕਰੋ", copied: "ਕਾਪੀ ਹੋ ਗਿਆ",
    thanks: "ਧੰਨਵਾਦ। ਤੁਹਾਡੀ ਬੇਨਤੀ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ।", language: "ਭਾਸ਼ਾ", fileHint: "PDF, Word, JPG ਜਾਂ PNG, 5 MB ਤੱਕ।",
    partialNotice: "{institute} ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕੇ, ਇਸ ਲਈ ਅਸੀਂ ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਨਾਲ-ਨਾਲ ਸੰਭਾਲਦੇ ਹਾਂ।",
  },
  ur: {
    next: "آگے", back: "پیچھے", send: "بھیجیں", sending: "بھیجا جا رہا ہے…", optional: "اختیاری", unsure: "آپ کو کس بارے میں یقین نہیں؟",
    unsurePh: "مثلاً: میں کلاؤڈ اور ڈیٹا میں سے انتخاب نہیں کر پا رہا/رہی", details: "آپ کی تفصیلات", name: "نام", email: "ای میل", phone: "فون",
    step: "مرحلہ", of: "میں سے", minutes: "تقریباً {n} منٹ", other: "دیگر", otherPh: "براہِ کرم بتائیں", yes: "ہاں", no: "نہیں", choose: "منتخب کریں…",
    attach: "فائل منسلک کریں", uploading: "اپ لوڈ ہو رہا ہے…", remove: "ہٹائیں", saveLater: "محفوظ کریں اور بعد میں مکمل کریں", welcomeBack: "دوبارہ خوش آمدید۔ اب تک کے آپ کے جوابات اسی براؤزر میں محفوظ ہیں۔", startOver: "دوبارہ شروع کریں",
    saved: "محفوظ ہو گیا۔ 30 دن کے اندر واپس آنے کے لیے یہ لنک استعمال کریں:", copy: "لنک کاپی کریں", copied: "کاپی ہو گیا",
    thanks: "شکریہ۔ آپ کی درخواست بھیج دی گئی ہے۔", language: "زبان", fileHint: "PDF، Word، JPG یا PNG، 5 MB تک۔",
    partialNotice: "ہم آپ کی معلومات ساتھ ساتھ محفوظ کرتے ہیں تاکہ {institute} آپ کی مدد کر سکے۔",
  },
  ar: {
    next: "التالي", back: "السابق", send: "إرسال", sending: "جارٍ الإرسال…", optional: "اختياري", unsure: "ما الذي لست متأكدًا منه؟",
    unsurePh: "مثلًا: لا أستطيع الاختيار بين الحوسبة السحابية والبيانات", details: "بياناتك", name: "الاسم", email: "البريد الإلكتروني", phone: "الهاتف",
    step: "الخطوة", of: "من", minutes: "حوالي {n} دقائق", other: "أخرى", otherPh: "يرجى التحديد", yes: "نعم", no: "لا", choose: "اختر…",
    attach: "إرفاق ملف", uploading: "جارٍ الرفع…", remove: "إزالة", saveLater: "احفظ وأكمل لاحقًا", welcomeBack: "مرحبًا بعودتك. إجاباتك حتى الآن محفوظة في هذا المتصفح.", startOver: "ابدأ من جديد",
    saved: "تم الحفظ. استخدم هذا الرابط للعودة خلال 30 يومًا:", copy: "نسخ الرابط", copied: "تم النسخ",
    thanks: "شكرًا لك. تم إرسال طلبك.", language: "اللغة", fileHint: "PDF أو Word أو JPG أو PNG، حتى 5 ميغابايت.",
    partialNotice: "نحفظ بياناتك أثناء التعبئة حتى يتمكن {institute} من مساعدتك.",
  },
  es: {
    next: "Siguiente", back: "Atrás", send: "Enviar", sending: "Enviando…", optional: "opcional", unsure: "¿Sobre qué tienes dudas?",
    unsurePh: "p. ej. no sé si elegir cloud o datos, o qué certificación me ayudaría a conseguir empleo", details: "Tus datos", name: "Nombre",
    email: "Correo electrónico", phone: "Teléfono", step: "Paso", of: "de", minutes: "Unos {n} min", other: "Otro", otherPh: "Especifica, por favor",
    yes: "Sí", no: "No", choose: "Elige…", attach: "Adjuntar un archivo", uploading: "Subiendo…", remove: "Quitar", saveLater: "Guardar y terminar después", welcomeBack: "Hola de nuevo. Tus respuestas hasta ahora están guardadas en este navegador.", startOver: "Empezar de nuevo",
    saved: "Guardado. Usa este enlace para volver en un plazo de 30 días:", copy: "Copiar enlace", copied: "Copiado",
    thanks: "Gracias. Tu solicitud se ha enviado.", language: "Idioma", fileHint: "PDF, Word, JPG o PNG, hasta 5 MB.",
    partialNotice: "Guardamos tus datos a medida que avanzas para que {institute} pueda ayudarte.",
    yourResults: "Tus resultados", yourResult: "Tu resultado", match: "Afinidad", continue: "Continuar", done: "Listo",
    yourScore: "Tu puntuación", share: "Compartir", shareText: "Obtuve un {n}% en {form}.", seeReport: "Ver tu informe completo", allAnswers: "Todas tus respuestas",
    yourStyle: "Tu estilo es", noAnswersKept: "Tus respuestas ya no se conservan.", sent: "Enviado el {date}", downloadPdf: "Descargar PDF",
    privateNote: "Esta página es solo para ti. Cualquiera con el enlace puede verla, así que no la compartas. Deja de funcionar 180 días después de enviar el formulario.",
  },
  fr: {
    next: "Suivant", back: "Retour", send: "Envoyer", sending: "Envoi…", optional: "facultatif", unsure: "Sur quoi hésitez-vous ?",
    unsurePh: "ex. je n'arrive pas à choisir entre le cloud et la data, ou quelle certification m'aiderait à trouver un emploi", details: "Vos coordonnées",
    name: "Nom", email: "E-mail", phone: "Téléphone", step: "Étape", of: "sur", minutes: "Environ {n} min", other: "Autre", otherPh: "Précisez",
    yes: "Oui", no: "Non", choose: "Choisir…", attach: "Joindre un fichier", uploading: "Envoi du fichier…", remove: "Retirer",
    saveLater: "Enregistrer et terminer plus tard", welcomeBack: "Bon retour. Vos réponses jusqu'ici sont gardées dans ce navigateur.", startOver: "Recommencer", saved: "Enregistré. Utilisez ce lien pour revenir sous 30 jours :", copy: "Copier le lien",
    copied: "Copié", thanks: "Merci. Votre demande a été envoyée.", language: "Langue", fileHint: "PDF, Word, JPG ou PNG, jusqu'à 5 Mo.",
    partialNotice: "Nous enregistrons vos informations au fur et à mesure pour que {institute} puisse vous aider.",
  },
};

/** Languages written right to left */
export const RTL = ["ur", "ar"];
