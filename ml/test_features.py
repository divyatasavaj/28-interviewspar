"""Feature-schema regressions shared by collection, training, and inference."""
import csv, json, subprocess, unittest
from pathlib import Path
from feature_extractor import extract_features
from infer import predict
ROOT=Path(__file__).resolve().parents[1]
class FeatureTests(unittest.TestCase):
    def test_synthetic_text_features_match_inference(self):
        for row in csv.DictReader((ROOT/'ml/data/synthetic_answers.csv').read_text().splitlines()):
            actual=extract_features(row['answer_text'])
            for key in ('star_present','hedge_word_freq','filler_word_count','answer_length'):
                self.assertEqual(actual[key],float(row[key]))
    def test_javascript_and_python_text_features_match(self):
        text='Human likelihood is high; um, I think maybe we built the result because it worked.'
        script="import {extractFeatures} from './backend/services/featureExtractor.js'; console.log(JSON.stringify(extractFeatures("+json.dumps(text)+")));"
        actual=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT,text=True))
        self.assertEqual(actual,extract_features(text))
    def test_zero_is_preserved_and_resume_gap_is_not_asserted(self):
        result=predict({'answer_text':'Short answer','fluency_score':0})
        self.assertEqual(result['features']['fluency_score'],0)
        self.assertNotEqual(result['label'],'resume-gap')
if __name__=='__main__':unittest.main()
