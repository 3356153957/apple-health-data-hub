from datetime import date, datetime, time

from server.api.apple_dashboard import CN_TZ, _dashboard_dates, _sleep_window


def test_default_dashboard_dates_use_yesterday_activity_and_latest_sleep_window():
    activity_day, sleep_day = _dashboard_dates(
        None,
        now=datetime(2026, 6, 10, 9, 0, tzinfo=CN_TZ),
    )

    assert activity_day == date(2026, 6, 9)
    assert sleep_day == date(2026, 6, 10)
    assert _sleep_window(sleep_day) == (
        datetime.combine(date(2026, 6, 9), time(18, 0)),
        datetime.combine(date(2026, 6, 10), time(12, 0)),
    )


def test_explicit_dashboard_date_keeps_activity_and_sleep_on_the_requested_day():
    requested = date(2026, 6, 9)

    assert _dashboard_dates(requested) == (requested, requested)
