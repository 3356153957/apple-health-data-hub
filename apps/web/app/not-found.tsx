import Link from "next/link";

export default function NotFound() {
  return (
    <section className="lead">
      <article className="card">
        <h2>页面不存在</h2>
        <div className="big">404</div>
        <p className="empty">这个页面暂时没有内容，可能是链接已经更新。</p>
        <div className="exp-action">
          <Link className="btn" href="/apple">
            返回健康概览
          </Link>
        </div>
      </article>
    </section>
  );
}
