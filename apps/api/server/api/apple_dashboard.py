"""Customer-facing Apple Health dashboard read routes.

These routes are additive to the iOS sync contract. They serve the local web
dashboard with owner-scoped, API-key-protected summaries and raw detail rows.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..ingestion.owner import OWNER_HEADER, resolve_owner_id
from .deps import get_session, verify_api_key

router = APIRouter(prefix="/api/apple", dependencies=[Depends(verify_api_key)])

CN_TZ = ZoneInfo("Asia/Shanghai")


def _dashboard_dates(target_date: date | None, now: datetime | None = None) -> tuple[date, date]:
    if target_date is not None:
        return target_date, target_date

    current_dt = now or datetime.now(CN_TZ)
    if current_dt.tzinfo is None:
        current_dt = current_dt.replace(tzinfo=CN_TZ)
    today = current_dt.astimezone(CN_TZ).date()
    return today - timedelta(days=1), today


def _default_target_date() -> date:
    return _dashboard_dates(None)[0]


def _default_sleep_date() -> date:
    return _dashboard_dates(None)[1]


def _sleep_window(sleep_day: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(sleep_day - timedelta(days=1), time(18, 0)),
        datetime.combine(sleep_day, time(12, 0)),
    )


def _minutes(ms: int | float | None) -> float | None:
    if ms is None:
        return None
    return round(float(ms) / 60000, 1)


def _pct(current: float | int | None, baseline: float | int | None) -> float | None:
    if current is None or baseline in (None, 0):
        return None
    return round(((float(current) - float(baseline)) / abs(float(baseline))) * 100, 1)


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _row_dict(row: Any | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: _json_value(value) for key, value in dict(row).items()}


def _activity_level(steps: int | None, active_minutes: int | None) -> str:
    steps = steps or 0
    active_minutes = active_minutes or 0
    if steps >= 8000 or active_minutes >= 30:
        return "充足"
    if steps >= 5000 or active_minutes >= 15:
        return "适中"
    return "偏少"


def _sleep_level(total_sleep_min: float | None, efficiency: float | None) -> str:
    if total_sleep_min is None:
        return "暂无"
    if total_sleep_min >= 420 and (efficiency is None or efficiency >= 85):
        return "恢复较好"
    if total_sleep_min >= 360:
        return "基本够用"
    return "偏少"


def _build_advice(
    activity: dict[str, Any] | None,
    sleep: dict[str, Any] | None,
    workouts: list[dict[str, Any]],
) -> list[str]:
    advice: list[str] = []
    steps = activity.get("steps") if activity else None
    active_minutes = activity.get("active_minutes") if activity else None
    sleep_min = sleep.get("total_sleep_min") if sleep else None
    efficiency = sleep.get("efficiency_pct") if sleep else None
    awake_min = sleep.get("awake_min") if sleep else None

    if steps is not None and steps < 5000:
        advice.append("昨日步数偏少，今天安排 20-30 分钟轻松步行，先把活动量补起来。")
    elif steps is not None and steps >= 8000:
        advice.append("昨日活动量不错，今天保持节奏，训练后注意补水和拉伸。")

    if active_minutes is not None and active_minutes < 20:
        advice.append("运动分钟偏少，可以用快走、骑车或力量训练补一个短时段。")

    if not workouts:
        advice.append("昨日没有记录到体能训练；如果实际训练过，检查 Apple Watch 体能训练是否同步。")

    if sleep_min is not None and sleep_min < 360:
        advice.append("昨夜睡眠少于 6 小时，今天训练强度建议保守，优先保证恢复。")
    elif sleep_min is not None and sleep_min >= 420:
        advice.append("昨夜睡眠时长达到 7 小时左右，适合安排正常学习和训练节奏。")

    if efficiency is not None and efficiency < 85:
        advice.append("睡眠效率略低，睡前减少强光和高刺激内容，观察今晚是否改善。")

    if awake_min is not None and awake_min >= 30:
        advice.append("夜间清醒时间偏长，留意晚间饮水、咖啡因和睡前压力。")

    return advice[:4] or ["继续保持规律佩戴和同步，系统会根据更多历史数据给出更稳定的建议。"]


@router.get("/daily-summary")
async def apple_daily_summary(
    request: Request,
    target_date: date | None = Query(default=None, alias="date"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Return yesterday's activity, last-night sleep, and practical advice."""
    owner_id = resolve_owner_id(request.headers.get(OWNER_HEADER))
    day, sleep_day = _dashboard_dates(target_date)
    params = {
        "owner_id": str(owner_id),
        "target_date": day,
        "baseline_start": day - timedelta(days=7),
    }

    activity_row = (
        await session.execute(
            text(
                """
                SELECT date, steps, distance_m, floors_climbed, active_calories,
                       total_calories, active_minutes, stand_hours,
                       (
                           SELECT round(sum(qs.value)::numeric, 1)
                           FROM quantity_samples qs
                           WHERE qs.owner_id = :owner_id
                             AND qs.metric_name = 'apple_stand_time'
                             AND date(qs.time AT TIME ZONE 'Asia/Shanghai') = :target_date
                       ) AS stand_minutes,
                       avg_hr, max_hr
                FROM daily_activity
                WHERE owner_id = :owner_id AND date = :target_date
                LIMIT 1
                """
            ),
            params,
        )
    ).mappings().first()
    baseline_row = (
        await session.execute(
            text(
                """
                SELECT avg(steps) AS steps_avg,
                       avg(active_calories) AS active_calories_avg,
                       avg(active_minutes) AS active_minutes_avg
                FROM daily_activity
                WHERE owner_id = :owner_id
                  AND date >= :baseline_start
                  AND date < :target_date
                """
            ),
            params,
        )
    ).mappings().first()

    sleep_start, sleep_end = _sleep_window(sleep_day)
    sleep_params = {
        **params,
        "sleep_start": sleep_start,
        "sleep_end": sleep_end,
        "baseline_sleep_start": sleep_start - timedelta(days=7),
    }
    sleep_row = (
        await session.execute(
            text(
                """
                SELECT s.start_time, s.end_time, s.total_duration_ms, s.awake_ms,
                       s.light_ms, s.deep_ms, s.rem_ms,
                       COALESCE(
                           s.respiratory_rate,
                           (
                               SELECT round(avg(qs.value)::numeric, 1)
                               FROM quantity_samples qs
                               WHERE qs.owner_id = s.owner_id
                                 AND qs.metric_name = 'respiratory_rate'
                                 AND qs.time >= s.start_time
                                 AND qs.time <= s.end_time
                           )
                       ) AS respiratory_rate
                FROM sleep_sessions s
                WHERE s.owner_id = :owner_id
                  AND (s.start_time AT TIME ZONE 'Asia/Shanghai') >= :sleep_start
                  AND (s.start_time AT TIME ZONE 'Asia/Shanghai') < :sleep_end
                ORDER BY s.total_duration_ms DESC NULLS LAST, s.start_time DESC
                LIMIT 1
                """
            ),
            sleep_params,
        )
    ).mappings().first()
    sleep_baseline_row = (
        await session.execute(
            text(
                """
                SELECT avg(total_duration_ms) AS total_duration_ms_avg,
                       avg(deep_ms) AS deep_ms_avg,
                       avg(rem_ms) AS rem_ms_avg,
                       avg(awake_ms) AS awake_ms_avg
                FROM sleep_sessions
                WHERE owner_id = :owner_id
                  AND (start_time AT TIME ZONE 'Asia/Shanghai') >= :baseline_sleep_start
                  AND (start_time AT TIME ZONE 'Asia/Shanghai') < :sleep_start
                """
            ),
            sleep_params,
        )
    ).mappings().first()

    workout_rows = (
        await session.execute(
            text(
                """
                SELECT start_time, end_time, sport_type,
                       duration_ms, calories, distance_m, avg_hr, max_hr
                FROM workouts
                WHERE owner_id = :owner_id
                  AND date(start_time AT TIME ZONE 'Asia/Shanghai') = :target_date
                ORDER BY start_time
                """
            ),
            params,
        )
    ).mappings().all()

    baseline = _row_dict(baseline_row) or {}
    activity = _row_dict(activity_row)
    if activity is not None:
        activity["distance_km"] = round((activity.get("distance_m") or 0) / 1000, 2)
        activity["level"] = _activity_level(activity.get("steps"), activity.get("active_minutes"))
        activity["baseline"] = baseline
        activity["delta_pct"] = {
            "steps": _pct(activity.get("steps"), baseline.get("steps_avg")),
            "active_calories": _pct(
                activity.get("active_calories"), baseline.get("active_calories_avg")
            ),
            "active_minutes": _pct(
                activity.get("active_minutes"), baseline.get("active_minutes_avg")
            ),
        }

    sleep = None
    if sleep_row is not None:
        raw_sleep = dict(sleep_row)
        total_sleep_min = _minutes(raw_sleep.get("total_duration_ms"))
        awake_min = _minutes(raw_sleep.get("awake_ms"))
        core_min = _minutes(raw_sleep.get("light_ms"))
        deep_min = _minutes(raw_sleep.get("deep_ms"))
        rem_min = _minutes(raw_sleep.get("rem_ms"))
        start_time = raw_sleep.get("start_time")
        end_time = raw_sleep.get("end_time")
        in_bed_min = None
        if isinstance(start_time, datetime) and isinstance(end_time, datetime):
            in_bed_min = round((end_time - start_time).total_seconds() / 60, 1)
        efficiency = (
            round((total_sleep_min / in_bed_min) * 100, 1)
            if total_sleep_min is not None and in_bed_min
            else None
        )
        sleep_baseline = _row_dict(sleep_baseline_row) or {}
        sleep = {
            "start_time": _json_value(start_time),
            "end_time": _json_value(end_time),
            "total_sleep_min": total_sleep_min,
            "in_bed_min": in_bed_min,
            "awake_min": awake_min,
            "core_min": core_min,
            "deep_min": deep_min,
            "rem_min": rem_min,
            "efficiency_pct": efficiency,
            "respiratory_rate": raw_sleep.get("respiratory_rate"),
            "level": _sleep_level(total_sleep_min, efficiency),
            "baseline": {
                "total_sleep_min_avg": _minutes(sleep_baseline.get("total_duration_ms_avg")),
                "deep_min_avg": _minutes(sleep_baseline.get("deep_ms_avg")),
                "rem_min_avg": _minutes(sleep_baseline.get("rem_ms_avg")),
                "awake_min_avg": _minutes(sleep_baseline.get("awake_ms_avg")),
            },
        }

    workouts = []
    for row in workout_rows:
        item = _row_dict(row) or {}
        item["duration_min"] = _minutes(item.pop("duration_ms", None))
        item["distance_km"] = (
            round(item["distance_m"] / 1000, 2) if item.get("distance_m") is not None else None
        )
        workouts.append(item)

    advice = _build_advice(activity, sleep, workouts)
    activity_text = "暂无昨日活动数据"
    if activity:
        activity_text = (
            f"昨日 {activity.get('steps') or 0:,} 步，"
            f"活动 {activity.get('active_minutes') or 0} 分钟，"
            f"消耗 {round(activity.get('active_calories') or 0)} kcal。"
        )
    sleep_text = "暂无昨夜睡眠数据"
    if sleep:
        sleep_text = (
            f"昨夜睡眠 {round((sleep.get('total_sleep_min') or 0) / 60, 1)} 小时，"
            f"效率 {sleep.get('efficiency_pct') or 0}%。"
        )

    return {
        "date": day.isoformat(),
        "timezone": "Asia/Shanghai",
        "generated_at": datetime.now(CN_TZ).isoformat(),
        "headline": f"{activity_text} {sleep_text}",
        "activity": activity,
        "sleep": sleep,
        "workouts": workouts,
        "advice": advice,
    }


_RAW_TABLES: dict[str, dict[str, Any]] = {
    "heart_rate": {
        "label": "心率",
        "columns": ["time", "bpm", "context", "source_id"],
        "sql": """
            SELECT time, bpm, context, source_id
            FROM heart_rate
            WHERE owner_id = :owner_id
            ORDER BY time DESC
            LIMIT :limit
        """,
    },
    "hrv": {
        "label": "HRV",
        "columns": ["time", "value_ms", "algorithm", "context", "source_id"],
        "sql": """
            SELECT time, value_ms, algorithm, context, source_id
            FROM hrv
            WHERE owner_id = :owner_id
            ORDER BY time DESC
            LIMIT :limit
        """,
    },
    "blood_oxygen": {
        "label": "血氧",
        "columns": ["time", "spo2_pct", "context", "source_id"],
        "sql": """
            SELECT time, spo2_pct, context, source_id
            FROM blood_oxygen
            WHERE owner_id = :owner_id
            ORDER BY time DESC
            LIMIT :limit
        """,
    },
    "daily_activity": {
        "label": "每日活动",
        "columns": [
            "date",
            "steps",
            "distance_m",
            "floors_climbed",
            "active_calories",
            "total_calories",
            "active_minutes",
            "stand_hours",
            "stand_minutes",
        ],
        "sql": """
            SELECT da.date, da.steps, da.distance_m, da.floors_climbed, da.active_calories,
                   da.total_calories, da.active_minutes, da.stand_hours,
                   (
                       SELECT round(sum(qs.value)::numeric, 1)
                       FROM quantity_samples qs
                       WHERE qs.owner_id = da.owner_id
                         AND qs.metric_name = 'apple_stand_time'
                         AND date(qs.time AT TIME ZONE 'Asia/Shanghai') = da.date
                   ) AS stand_minutes
            FROM daily_activity da
            WHERE da.owner_id = :owner_id
            ORDER BY da.date DESC
            LIMIT :limit
        """,
    },
    "sleep_sessions": {
        "label": "睡眠记录",
        "columns": [
            "start_time",
            "end_time",
            "total_sleep_min",
            "awake_min",
            "core_min",
            "deep_min",
            "rem_min",
            "respiratory_rate",
        ],
        "sql": """
            SELECT s.start_time, s.end_time,
                   round(s.total_duration_ms / 60000.0, 1) AS total_sleep_min,
                   round(s.awake_ms / 60000.0, 1) AS awake_min,
                   round(s.light_ms / 60000.0, 1) AS core_min,
                   round(s.deep_ms / 60000.0, 1) AS deep_min,
                   round(s.rem_ms / 60000.0, 1) AS rem_min,
                   COALESCE(
                       s.respiratory_rate,
                       (
                           SELECT round(avg(qs.value)::numeric, 1)
                           FROM quantity_samples qs
                           WHERE qs.owner_id = s.owner_id
                             AND qs.metric_name = 'respiratory_rate'
                             AND qs.time >= s.start_time
                             AND qs.time <= s.end_time
                       )
                   ) AS respiratory_rate
            FROM sleep_sessions s
            WHERE s.owner_id = :owner_id
            ORDER BY s.start_time DESC
            LIMIT :limit
        """,
    },
    "workouts": {
        "label": "体能训练",
        "columns": [
            "start_time",
            "end_time",
            "sport_type",
            "duration_min",
            "calories",
            "distance_m",
            "avg_hr",
            "max_hr",
        ],
        "sql": """
            SELECT start_time, end_time, sport_type,
                   round(duration_ms / 60000.0, 1) AS duration_min,
                   calories, distance_m, avg_hr, max_hr
            FROM workouts
            WHERE owner_id = :owner_id
            ORDER BY start_time DESC
            LIMIT :limit
        """,
    },
    "quantity_samples": {
        "label": "其他连续指标",
        "columns": ["time", "metric_name", "value", "unit", "source_id"],
        "sql": """
            SELECT time, metric_name, value, unit, source_id
            FROM quantity_samples
            WHERE owner_id = :owner_id
            ORDER BY time DESC
            LIMIT :limit
        """,
    },
}


@router.get("/raw/{table}")
async def apple_raw_detail(
    table: str,
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Return recent rows for one raw Apple Health sync table."""
    spec = _RAW_TABLES.get(table)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"unknown Apple Health table: {table}")
    owner_id = resolve_owner_id(request.headers.get(OWNER_HEADER))
    rows = (
        await session.execute(text(spec["sql"]), {"owner_id": str(owner_id), "limit": limit})
    ).mappings().all()
    return {
        "table": table,
        "label": spec["label"],
        "columns": spec["columns"],
        "rows": [_row_dict(row) for row in rows],
    }
