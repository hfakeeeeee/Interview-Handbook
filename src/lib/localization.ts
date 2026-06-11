import type { Language, LocalizedText } from "../types";

export const languages: Language[] = ["en", "vi"];

export const languageLabels: Record<Language, string> = {
  en: "English",
  vi: "Vietnamese",
};

export const emptyLocalizedText = (): LocalizedText => ({
  en: "",
  vi: "",
});

export function normalizeLocalizedText(value: unknown, legacyLanguage: Language = "vi"): LocalizedText {
  if (typeof value === "string") {
    return {
      en: legacyLanguage === "en" ? value : "",
      vi: legacyLanguage === "vi" ? value : "",
    };
  }

  if (value && typeof value === "object") {
    const record = value as Partial<Record<Language, unknown>>;

    return {
      en: typeof record.en === "string" ? record.en : "",
      vi: typeof record.vi === "string" ? record.vi : "",
    };
  }

  return emptyLocalizedText();
}

export function getLocalizedText(value: LocalizedText, language: Language) {
  const primary = value[language]?.trim();

  if (primary) {
    return {
      fallbackLanguage: null,
      text: primary,
    };
  }

  const fallbackLanguage = language === "en" ? "vi" : "en";
  const fallback = value[fallbackLanguage]?.trim();

  return {
    fallbackLanguage: fallback ? fallbackLanguage : null,
    text: fallback || "",
  };
}

export function hasLocalizedPair(question: LocalizedText, answer: LocalizedText) {
  return languages.some((language) => question[language].trim() && answer[language].trim());
}

export function localizedSearchText(...values: LocalizedText[]) {
  return values.flatMap((value) => languages.map((language) => value[language])).join(" ");
}
