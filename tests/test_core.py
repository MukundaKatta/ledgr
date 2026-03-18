"""Tests for Ledgr."""
from src.core import Ledgr
def test_init(): assert Ledgr().get_stats()["ops"] == 0
def test_op(): c = Ledgr(); c.process(x=1); assert c.get_stats()["ops"] == 1
def test_multi(): c = Ledgr(); [c.process() for _ in range(5)]; assert c.get_stats()["ops"] == 5
def test_reset(): c = Ledgr(); c.process(); c.reset(); assert c.get_stats()["ops"] == 0
def test_service_name(): c = Ledgr(); r = c.process(); assert r["service"] == "ledgr"
