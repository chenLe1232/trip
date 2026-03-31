export default function Home() {
  return (
    <main>
      <header className="top-nav">
        <a href="#home">首页</a>
        <a href="#about">关于我</a>
        <a href="#projects">项目</a>
        <a href="#contact">联系</a>
        <a href="/login">后台登录</a>
      </header>

      <section id="home" className="hero section">
        <h1>你好，我是你的个人网站首页</h1>
        <p>这是一个简约单页（SPA 风格）展示页，支持平滑浏览不同模块。</p>
      </section>

      <section id="about" className="section">
        <h2>关于我</h2>
        <p>这里可以放你的个人介绍、职业方向、技能标签等内容。</p>
      </section>

      <section id="projects" className="section">
        <h2>我的项目</h2>
        <ul>
          <li>项目 A：在线内容管理</li>
          <li>项目 B：数据可视化仪表盘</li>
          <li>项目 C：自动化效率工具</li>
        </ul>
      </section>

      <section id="contact" className="section">
        <h2>联系我</h2>
        <p>邮箱：you@example.com</p>
      </section>
    </main>
  );
}
