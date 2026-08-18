from app.services.anticheat import _LEVEL_MAP, _CATEGORY_MAP, compile_integrity_summary


class DummyCollection:
    def __init__(self, data=None):
        self.data = data or {}

    def find_one(self, query):
        if "session_id" in query and query["session_id"] == self.data.get("session_id"):
            return self.data
        return None


class DummyDB:
    def __init__(self, log_data):
        self.integrity_logs = DummyCollection(log_data)


def test_device_event_mappings():
    assert _LEVEL_MAP["mobile_phone_detected"] == "critical"
    assert _CATEGORY_MAP["mobile_phone_detected"] == "device"


def test_compile_integrity_summary_escalates_device_event_to_high_risk():
    session_id = "test-session-123"
    log_data = {
        "session_id": session_id,
        "events": [
            {
                "type": "mobile_phone_detected",
                "device_type": "cell_phone",
                "confidence": 0.92,
                "timestamp": "2026-08-18T12:00:00Z",
            }
        ],
    }
    db = DummyDB(log_data)
    summary = compile_integrity_summary(db, session_id)

    assert summary["risk_level"] == "high"
    assert summary["critical_count"] == 1
    assert "device" in summary["categories"]
    assert summary["categories"]["device"]["count"] == 1
