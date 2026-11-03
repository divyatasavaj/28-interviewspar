import re
from typing import Optional
from dataclasses import dataclass


@dataclass
class RelevanceResult:
    score: float
    is_relevant: bool
    matched_keywords: list[str]
    missing_keywords: list[str]
    explanation: str


class RelevanceValidator:
    def __init__(self, threshold: float = 0.3):
        self.threshold = threshold
        self.stopwords = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
            'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'my', 'your', 'his', 'her', 'its', 'our', 'their', 'am', 'is', 'are'
        }

    def _extract_keywords(self, text: str) -> set[str]:
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        return {w for w in words if w not in self.stopwords and len(w) > 2}

    def _extract_question_intent(self, question: str) -> dict:
        question_lower = question.lower()
        intent = {
            'type': 'general',
            'expected_entities': [],
            'keywords': self._extract_keywords(question),
            'question_words': []
        }

        # Detect question type
        if any(w in question_lower for w in ['name', 'call', 'called']):
            intent['type'] = 'name'
            intent['expected_entities'] = ['person_name']
        elif any(w in question_lower for w in ['where', 'location', 'city', 'country', 'from']):
            intent['type'] = 'location'
            intent['expected_entities'] = ['place']
        elif any(w in question_lower for w in ['experience', 'worked', 'work', 'job', 'role', 'position']):
            intent['type'] = 'experience'
            intent['expected_entities'] = ['company', 'role', 'duration', 'skills']
        elif any(w in question_lower for w in ['skill', 'know', 'familiar', 'technology', 'language', 'framework']):
            intent['type'] = 'skills'
            intent['expected_entities'] = ['technology', 'framework', 'language', 'tool']
        elif any(w in question_lower for w in ['project', 'built', 'developed', 'created', 'made']):
            intent['type'] = 'project'
            intent['expected_entities'] = ['project_name', 'description', 'tech_stack', 'role']
        elif any(w in question_lower for w in ['why', 'reason', 'motivation', 'interested']):
            intent['type'] = 'motivation'
            intent['expected_entities'] = ['reason', 'interest', 'goal']
        elif any(w in question_lower for w in ['challenge', 'difficult', 'problem', 'solve', 'debug']):
            intent['type'] = 'problem_solving'
            intent['expected_entities'] = ['problem', 'approach', 'solution', 'outcome']

        # Extract question words (who, what, where, when, why, how)
        q_words = ['who', 'what', 'where', 'when', 'why', 'how', 'which', 'whose']
        intent['question_words'] = [w for w in q_words if w in question_lower]

        return intent

    def validate(self, question: str, answer: str, context: str = "") -> RelevanceResult:
        if not answer or len(answer.strip()) < 5:
            return RelevanceResult(
                score=0.0,
                is_relevant=False,
                matched_keywords=[],
                missing_keywords=[],
                explanation="Answer is too short or empty"
            )

        question_intent = self._extract_question_intent(question)
        answer_keywords = self._extract_keywords(answer)
        question_keywords = question_intent['keywords']

        matched = answer_keywords & question_keywords
        missing = question_keywords - answer_keywords

        # Calculate base score
        if len(question_keywords) == 0:
            base_score = 0.5
        else:
            base_score = len(matched) / len(question_keywords)

        # Boost for answering the question type appropriately
        type_bonus = 0.0
        answer_lower = answer.lower()

        if question_intent['type'] == 'name':
            if re.search(r'\b(my name is|i am|i\'m|name is)\b', answer_lower):
                type_bonus = 0.3
            elif len(answer.split()) <= 3 and not any(c.isdigit() for c in answer):
                type_bonus = 0.2
        elif question_intent['type'] == 'location':
            if any(w in answer_lower for w in ['from', 'in', 'at', 'live', 'based', 'located']):
                type_bonus = 0.2
        elif question_intent['type'] == 'experience':
            if any(w in answer_lower for w in ['year', 'month', 'experience', 'worked', 'role', 'position', 'company']):
                type_bonus = 0.2
        elif question_intent['type'] == 'skills':
            if any(w in answer_lower for w in ['know', 'familiar', 'experience', 'used', 'worked with', 'proficient']):
                type_bonus = 0.2

        final_score = min(1.0, base_score + type_bonus)
        is_relevant = final_score >= self.threshold

        explanation_parts = []
        if matched:
            explanation_parts.append(f"Matched keywords: {', '.join(sorted(matched)[:5])}")
        if missing:
            explanation_parts.append(f"Missing key concepts: {', '.join(sorted(missing)[:5])}")
        if not is_relevant:
            explanation_parts.append(f"Score {final_score:.2f} below threshold {self.threshold}")

        return RelevanceResult(
            score=final_score,
            is_relevant=is_relevant,
            matched_keywords=sorted(matched),
            missing_keywords=sorted(missing),
            explanation='; '.join(explanation_parts) if explanation_parts else "Answer appears relevant"
        )


def create_relevance_validator(threshold: float = 0.3) -> RelevanceValidator:
    return RelevanceValidator(threshold=threshold)
