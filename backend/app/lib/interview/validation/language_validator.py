import re
from typing import Optional
from langdetect import detect, DetectorFactory, LangDetectException

DetectorFactory.seed = 0

SUPPORTED_LANGUAGES = {
    'en': 'English',
    'hi': 'Hindi',
    'gu': 'Gujarati',
    'mr': 'Marathi',
    'ta': 'Tamil',
    'te': 'Telugu',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'bn': 'Bengali',
    'pa': 'Punjabi',
    'or': 'Odia',
    'as': 'Assamese',
}

INDIAN_LANGUAGE_PATTERNS = {
    'gu': [r'[\u0A80-\u0AFF]'],
    'hi': [r'[\u0900-\u097F]'],
}

class LanguageValidator:
    def __init__(self, allowed_languages: list[str] = None, strict_mode: bool = False):
        self.allowed_languages = allowed_languages or ['en']
        self.strict_mode = strict_mode
        self._compile_patterns()

    def _compile_patterns(self):
        self.patterns = {}
        for lang, patterns in INDIAN_LANGUAGE_PATTERNS.items():
            self.patterns[lang] = [re.compile(p, re.IGNORECASE) for p in patterns]

    def detect_language(self, text: str) -> tuple[str, float]:
        if not text or len(text.strip()) < 3:
            return 'unknown', 0.0
        
        text = text.strip()
        
        # First check for Indian language patterns
        for lang, patterns in self.patterns.items():
            for pattern in patterns:
                if pattern.search(text):
                    return lang, 0.9
        
        # Use langdetect for general detection
        try:
            detected = detect(text)
            return detected, 0.8
        except LangDetectException:
            pass
        
        # Fallback: check for English words
        english_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their'}
        words = set(re.findall(r'\b\w+\b', text.lower()))
        english_count = len(words & english_words)
        if english_count > len(words) * 0.3:
            return 'en', 0.7
        
        return 'unknown', 0.0

    def is_allowed(self, text: str) -> tuple[bool, str, float]:
        lang, confidence = self.detect_language(text)
        
        if lang == 'unknown':
            return True, 'unknown', 0.0
        
        if lang in self.allowed_languages:
            return True, lang, confidence
        
        lang_name = SUPPORTED_LANGUAGES.get(lang, lang)
        allowed_names = [SUPPORTED_LANGUAGES.get(l, l) for l in self.allowed_languages]
        
        if self.strict_mode:
            return False, lang, confidence
        
        return False, lang, confidence

    def validate(self, text: str, question_context: str = "") -> dict:
        is_allowed, detected_lang, confidence = self.is_allowed(text)
        
        if is_allowed or detected_lang == 'unknown':
            return {
                'valid': True,
                'detected_language': detected_lang,
                'confidence': confidence,
                'message': '',
                'suggestions': []
            }
        
        lang_name = SUPPORTED_LANGUAGES.get(detected_lang, detected_lang)
        allowed_names = [SUPPORTED_LANGUAGES.get(l, l) for l in self.allowed_languages]
        
        return {
            'valid': False,
            'detected_language': detected_lang,
            'confidence': confidence,
            'message': f"Please respond in {', '.join(allowed_names)}. Your answer appears to be in {lang_name}.",
            'suggestions': [
                f"Please provide your answer in {allowed_names[0]}",
                "Keep communication language as English" if 'en' in self.allowed_languages else f"Use {allowed_names[0]}"
            ]
        }


def create_language_validator(allowed_languages: list[str] = None) -> LanguageValidator:
    return LanguageValidator(allowed_languages=allowed_languages or ['en'], strict_mode=False)