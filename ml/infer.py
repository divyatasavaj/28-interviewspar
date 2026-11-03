"""Experimental coaching classifier with explicit provenance and a text-only fallback."""
import hashlib
import json
import math
from pathlib import Path
try:
    from .feature_extractor import extract_features, FEATURE_COLUMNS
except ImportError:
    from feature_extractor import extract_features, FEATURE_COLUMNS

MODEL_DIR=Path(__file__).resolve().parent/'models'

def heuristic(features):
    if features['filler_word_count']>=4 or features['answer_length']>=180:
        return 'rambling'
    if features['hedge_word_freq']>=3:
        return 'underselling'
    if not features['star_present']:
        return 'no-structure'
    return 'good-answer'

def number(payload,key,default):
    value=payload.get(key,default)
    value=default if value is None else float(value)
    return max(0,value) if math.isfinite(value) else default

def predict(payload):
    features=extract_features(payload.get('answer_text',''),
        response_latency=number(payload,'response_latency',0),code_correct=int(number(payload,'code_correct',0)),
        pause_count=int(number(payload,'pause_count',0)),grammar_errors=int(number(payload,'grammar_errors',0)),
        fluency_score=min(100,number(payload,'fluency_score',100)))
    result={'label':heuristic(features),'confidence':None,'source':'heuristic',
            'experimental':True,'features':features,
            'top_features':[{'feature':f,'value':features[f],'weight':None} for f in ['filler_word_count','hedge_word_freq','star_present']]}
    try:
        metadata=json.loads((MODEL_DIR/'meta.json').read_text())
        model_path=MODEL_DIR/'classifier.pkl'
        if metadata.get('feature_schema_version')!=2 or metadata.get('features')!=FEATURE_COLUMNS:
            return result
        if hashlib.sha256(model_path.read_bytes()).hexdigest()!=metadata.get('artifact_sha256'):
            return result
        import joblib
        import pandas as pd
        model=joblib.load(model_path)
        X=pd.DataFrame([[features[f] for f in FEATURE_COLUMNS]],columns=FEATURE_COLUMNS)
        label=str(model.predict(X)[0])
        # No resume evidence enters this classifier; never present a resume contradiction claim.
        if label in ('resume-gap','silent-coding'):
            result['model_label']=label
            return result
        result.update(label=label,source='model:'+metadata['model'],confidence=float(max(model.predict_proba(X)[0])),
                      training_data=metadata.get('data_provenance','unknown'))
        if hasattr(model,'named_steps') and 'classifier' in model.named_steps:
            classifier=model.named_steps['classifier']
            transformed=model.named_steps['scale'].transform(X)[0]
            coefficients=classifier.coef_[list(classifier.classes_).index(label)]
            contributions=[{'feature':f,'value':features[f],'weight':round(float(v*c),4)} for f,v,c in zip(FEATURE_COLUMNS,transformed,coefficients)]
            result['top_features']=sorted(contributions,key=lambda x:abs(x['weight']),reverse=True)[:3]
        else:
            result['explanation_note']='Reported feature values are observations, not causal contributions.'
    except (OSError,ValueError,KeyError,ImportError,AttributeError,TypeError):
        result['model_status']='unavailable'
    return result

if __name__=='__main__':
    import sys
    try:
        print(json.dumps(predict(json.loads(sys.stdin.read() or '{}'))))
    except (ValueError,TypeError):
        print(json.dumps({'label':None,'source':'invalid-input','experimental':True}))
