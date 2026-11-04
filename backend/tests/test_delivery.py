"""Delivery metrics preserve uncertainty, timing consistency, and transcript provenance."""
import unittest
from pydantic import ValidationError
from app.delivery import DeliveryObservation, delivery_feedback, summarize_delivery


def observed(**changes):
    data = {"consent":True, "transcript":"Um I mean I built a service because our team needed reliable access and clearer reporting.",
        "audio":{"capture_ms":12000,"observed_ms":12000,"voiced_ms":7000,"speech_span_ms":10000,
                 "pause_count":2,"pause_ms":3000,"longest_pause_ms":2000,"sample_count":240,"clipped_samples":0},
        "camera":{"samples":20,"face_samples":18,"centered_samples":15,"multiple_samples":1},
        "focus":{"observed_ms":10000,"hidden_ms":2000,"hidden_count":1},"confidence_self_rating":4}
    data.update(changes)
    return data


class DeliveryTests(unittest.TestCase):
    def test_observations_use_spoken_words_not_edited_answer(self):
        source=observed()
        result=delivery_feedback(DeliveryObservation(**source),"A corrected answer with different wording.")
        self.assertEqual(result['filler_count'],2)
        self.assertEqual(result['words_per_minute'],96)
        self.assertTrue(result['transcript_edited'])
        self.assertEqual(result['face_presence_percent'],90)
        self.assertEqual(result['page_visible_percent'],80)
        self.assertEqual(result['confidence_self_rating'],4)
        self.assertNotIn('confidence_score',result)

    def test_no_measurement_is_not_a_zero_score(self):
        self.assertIsNone(delivery_feedback(None,"Typed answer"))
        result=delivery_feedback(DeliveryObservation(consent=True),"Typed answer")
        for key in ['words_per_minute','filler_count','face_presence_percent','page_visible_percent','confidence_self_rating']:
            self.assertIsNone(result[key])
        self.assertIsNone(summarize_delivery([]))

    def test_low_coverage_and_silent_audio_cannot_produce_pace(self):
        for change in ({'capture_ms':60000},{'voiced_ms':0,'speech_span_ms':0,'pause_ms':0,'pause_count':0,'longest_pause_ms':0}):
            source=observed();source['audio'].update(change)
            self.assertIsNone(delivery_feedback(DeliveryObservation(**source),source['transcript'])['words_per_minute'])

    def test_rejects_forged_scores_invalid_counts_and_unconsented_observations(self):
        for changes in ({'consent':False},{'confidence_self_rating':6},{'confidence_self_rating':True},{'confidence_score':99}):
            with self.assertRaises(ValidationError): DeliveryObservation(**observed(**changes))
        for key,value in [('voiced_ms',14000),('pause_ms',11000),('clipped_samples',241),('observed_ms',float('nan')),('sample_count',-1)]:
            source=observed();source['audio'][key]=value
            with self.assertRaises(ValidationError): DeliveryObservation(**source)
        source=observed();source['camera']['face_samples']=21
        with self.assertRaises(ValidationError): DeliveryObservation(**source)

    def test_summary_weights_samples_and_excludes_skipped_answers(self):
        first=delivery_feedback(DeliveryObservation(**observed()),'Edited')
        second=delivery_feedback(DeliveryObservation(**observed(camera={'samples':80,'face_samples':40,'centered_samples':20,'multiple_samples':0},confidence_self_rating=2)),'Edited')
        report=summarize_delivery([{'evaluation':{'delivery':first}},{'evaluation':{'delivery':second}},{'skipped':True,'evaluation':{'delivery':first}}])
        self.assertEqual(report['answers_observed'],2)
        self.assertEqual(report['face_presence_percent'],58)
        self.assertEqual(report['confidence_self_rating'],3)
        self.assertEqual(report['filler_count'],4)

    def test_context_dependent_terms_are_separate(self):
        result=delivery_feedback(DeliveryObservation(consent=True,transcript='I like well designed APIs. Actually this works.'),'')
        self.assertEqual(result['filler_count'],0)
        self.assertEqual(result['possible_filler_count'],3)

    def test_incomplete_transcript_does_not_claim_speaking_pace(self):
        result=delivery_feedback(DeliveryObservation(**observed(transcript_complete=False)), 'Reviewed answer')
        self.assertIsNone(result['words_per_minute'])
        self.assertFalse(result['transcript_complete'])


if __name__ == '__main__': unittest.main()
