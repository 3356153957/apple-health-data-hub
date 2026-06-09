const METRIC_LABELS: Record<string, string> = {
  "activity.active_energy": "活动能量",
  "activity.exercise_minutes": "运动分钟",
  "activity.flights_climbed": "已爬楼层",
  "activity.resting_energy": "静息能量",
  "activity.stand_minutes": "站立时间",
  "activity.steps": "步数",
  "activity.walking_running_distance": "步行和跑步距离",
  "body.weight": "体重",
  "body.wrist_temperature": "腕温",
  "cardio.vo2_max": "VO2 max",
  "sleep.session": "睡眠记录",
  "sleep.stage": "睡眠阶段",
  "vital.blood_oxygen": "血氧",
  "vital.heart_rate": "心率",
  "vital.hrv_sdnn": "HRV",
  "vital.respiratory_rate": "呼吸次数",
  "vital.resting_heart_rate": "静息心率",
  "vital.walking_heart_rate": "步行心率",
};

const DISPLAY_LABELS: Record<string, string> = {
  "Active Energy": "活动能量",
  "Blood Oxygen": "血氧",
  "Body Weight": "体重",
  "Exercise Minutes": "运动分钟",
  "Flights Climbed": "已爬楼层",
  "Heart Rate": "心率",
  "Heart Rate Variability": "HRV",
  "Respiratory Rate": "呼吸次数",
  "Resting Energy": "静息能量",
  "Resting Heart Rate": "静息心率",
  "Sleep Session": "睡眠记录",
  "Sleep Stage": "睡眠阶段",
  "Stand Minutes": "站立时间",
  "Steps": "步数",
  "Walking + Running Distance": "步行和跑步距离",
  "Walking Heart Rate": "步行心率",
  "Workout Session": "体能训练",
  "Wrist Temperature": "腕温",
};

export function metricLabel(metricId: string | null | undefined, fallback?: string | null): string {
  if (metricId && METRIC_LABELS[metricId]) return METRIC_LABELS[metricId];
  if (fallback && DISPLAY_LABELS[fallback]) return DISPLAY_LABELS[fallback];
  return fallback || metricId || "健康指标";
}

export function sourcePluginLabel(sourceId: string | null | undefined): string {
  if (!sourceId) return "私密记录";
  const normalized = sourceId.toLowerCase();
  if (normalized.includes("apple-health")) return "Apple 健康同步";
  if (normalized === "unknown") return "私密记录";
  return sourceId;
}

export function rangeLabel(range: string | null | undefined): string {
  if (range === "24h") return "24 小时";
  if (range === "7d") return "7 天";
  if (range === "30d") return "30 天";
  if (range === "90d") return "90 天";
  if (range === "1y") return "1 年";
  return range || "近期";
}
