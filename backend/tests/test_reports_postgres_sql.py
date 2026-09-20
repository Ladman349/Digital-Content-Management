"""
The suite runs on SQLite, which forgives SQL that PostgreSQL refuses. The report's day and hour
buckets are integer arithmetic, and the first version rendered on PostgreSQL as
``FLOOR(x / 3600000) % 24``: a double, for which PostgreSQL has no ``%`` operator. Every test passed
and the endpoint failed in production's dialect. This pins the PostgreSQL rendering instead.
"""

from sqlalchemy.dialects import postgresql

from app.models.play_stat import PlayStat
from app.services.report_service import _24, _DAY, _HOUR, _OFFSET


def _render(expression) -> str:
    return str(expression.compile(dialect=postgresql.dialect()))


def test_bucket_arithmetic_stays_in_integers_on_postgresql():
    day = _render((PlayStat.hourStart + _OFFSET) // _DAY)
    hour = _render(((PlayStat.hourStart + _OFFSET) // _HOUR) % _24)
    for sql in (day, hour):
        assert "FLOOR" not in sql.upper(), sql
        assert "%(" not in sql, f"bucket expressions must not use bind parameters: {sql}"
    assert day == '(play_stats."hourStart" + 19800000) / 86400000'
    assert hour == '((play_stats."hourStart" + 19800000) / 3600000) %% 24'
