export function UnlockForm({ error, next }: { error: string; next: string }) {
  return (
    <form action="/unlock/submit" className="unlock-form" method="post">
      <input type="hidden" name="next" value={next} />
      <label>
        <span>访问密码</span>
        <input name="password" type="password" inputMode="numeric" autoComplete="current-password" autoFocus required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">进入健康应用</button>
    </form>
  );
}
