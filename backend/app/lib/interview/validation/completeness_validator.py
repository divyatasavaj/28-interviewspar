import re
from typing import Optional
from dataclasses import dataclass


@dataclass
class CompletenessResult:
    score: float
    is_complete: bool
    missing_fields: list[str]
    detected_fields: dict[str, str]
    explanation: str


class CompletenessValidator:
    def __init__(self, required_fields: list[str] = None, min_words: int = 5):
        self.required_fields = required_fields or []
        self.min_words = min_words
        self.field_patterns = {
            'name': [
                r'\b(my name is|i am|i\'m|name is)\s+([a-zA-Z\s]+)',
                r'\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b',
            ],
            'email': [
                r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b',
            ],
            'phone': [
                r'\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
            ],
            'location': [
                r'\b(from|in|at|based in|located in)\s+([A-Za-z\s,]+)',
                r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*[A-Z]{2}\b',
            ],
            'experience_years': [
                r'\b(\d+)\s*(year|yr|years)\b',
                r'\b(experience|worked)\s*(?:of|for)?\s*(\d+)\s*(year|yr|years)',
            ],
            'company': [
                r'\b(work at|worked at|employed at|company|organization)\s+([A-Za-z0-9\s&.]+)',
            ],
            'role': [
                r'\b(as a|role|position|title)\s+(?:of|is)?\s*([A-Za-z\s]+)',
                r'\b(software engineer|developer|manager|analyst|designer|architect)\b',
            ],
        }

    def _extract_field(self, text: str, field: str) -> Optional[str]:
        if field in ("technology", "tech_stack"):
            match = re.search(r"\b(python|java(?:script)?|typescript|react|sql|docker|node|go|rust|c\+\+)\b", text, re.I)
            return match.group(0) if match else None
        if field == "description":
            return text.strip() if len(text.split()) >= 10 else None
        if field == "project_name":
            match = re.search(r"(?:project|application|app)\s+(?:called|named)?\s*([\w -]{3,60})", text, re.I)
            return match.group(1).strip() if match else None
        patterns = self.field_patterns.get(field, [])
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if match.lastindex and match.lastindex >= 2:
                    return match.group(2).strip()
                return match.group(1).strip() if match.lastindex == 1 else match.group(0).strip()
        return None

    def _detect_all_fields(self, text: str) -> dict[str, str]:
        detected = {}
        for field in [*self.field_patterns, "technology", "tech_stack", "description", "project_name"]:
            value = self._extract_field(text, field)
            if value:
                detected[field] = value
        return detected

    def validate(self, question: str, answer: str, expected_fields: list[str] = None) -> CompletenessResult:
        if not answer or len(answer.split()) < self.min_words:
            return CompletenessResult(
                score=0.0,
                is_complete=False,
                missing_fields=expected_fields or self.required_fields,
                detected_fields={},
                explanation=f"Answer too short (minimum {self.min_words} words required)"
            )
        
        fields_to_check = expected_fields or self.required_fields
        detected = self._detect_all_fields(answer)
        
        found_fields = [f for f in fields_to_check if f in detected]
        missing_fields = [f for f in fields_to_check if f not in detected]
        
        # Also check word count
        word_count = len(answer.split())
        word_score = min(1.0, word_count / (self.min_words * 2))
        
        field_score = len(found_fields) / len(fields_to_check) if fields_to_check else 1.0
        
        final_score = (field_score * 0.7) + (word_score * 0.3)
        is_complete = final_score >= 0.6 and len(missing_fields) == 0
        
        explanation_parts = []
        if found_fields:
            explanation_parts.append(f"Detected: {', '.join(f'{k}={v}' for k,v in detected.items() if k in found_fields)}")
        if missing_fields:
            explanation_parts.append(f"Missing required fields: {', '.join(missing_fields)}")
        explanation_parts.append(f"Word count: {word_count}")
        
        return CompletenessResult(
            score=final_score,
            is_complete=is_complete,
            missing_fields=missing_fields,
            detected_fields=detected,
            explanation='; '.join(explanation_parts)
        )


def create_completeness_validator(required_fields: list[str] = None, min_words: int = 5) -> CompletenessValidator:
    return CompletenessValidator(required_fields=required_fields, min_words=min_words)