import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  DatabaseZap,
  Filter,
  MessageCircle,
  PackageCheck,
  Palette,
  RadioTower,
  SendHorizontal,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Smartphone,
  WalletCards,
} from "lucide-react";

const plans = [
  {
    id: "stream",
    category: "large",
    name: "追番畅享卡",
    monthly: "39",
    data: "180G",
    voice: "100分钟",
    carrier: "电信 / 联通优选",
    fit: "视频、直播、热点共享",
    label: "当前推荐",
    tone: "blue",
    notes: ["演示套餐", "首充规则待同步", "禁发区需预检"],
  },
  {
    id: "daily",
    category: "daily",
    name: "星蓝通勤卡",
    monthly: "29",
    data: "135G",
    voice: "100分钟",
    carrier: "电信 / 广电优选",
    fit: "导航、短视频、轻办公",
    label: "日常省心",
    tone: "cyan",
    notes: ["低月租", "流量够用", "规则清晰"],
  },
  {
    id: "budget",
    category: "budget",
    name: "长期守护卡",
    monthly: "19",
    data: "100G",
    voice: "按套餐",
    carrier: "运营商可选",
    fit: "家人副卡、备用机",
    label: "低预算",
    tone: "gold",
    notes: ["适合副卡", "客服提醒", "地区先查"],
  },
  {
    id: "work",
    category: "work",
    name: "办公热点卡",
    monthly: "49",
    data: "220G",
    voice: "按套餐",
    carrier: "联通 / 电信优选",
    fit: "外勤、直播辅助、移动办公",
    label: "热点优先",
    tone: "navy",
    notes: ["高流量", "外勤备用", "覆盖先查"],
  },
];

const filters = [
  { id: "all", label: "全部" },
  { id: "large", label: "大流量" },
  { id: "daily", label: "日常" },
  { id: "budget", label: "低月租" },
  { id: "work", label: "办公" },
];

const precheckCards = [
  {
    icon: ShieldCheck,
    title: "规则先确认",
    text: "禁发区、年龄、首充、实名信息先查清楚，再进入下单。",
  },
  {
    icon: Bell,
    title: "激活提醒",
    text: "快递激活、上门激活、自主激活的步骤差异会提前提示。",
  },
  {
    icon: DatabaseZap,
    title: "API 预留",
    text: "商品、选号、订单回传可在拿到 172 API 后继续接入。",
  },
];

const flowSteps = [
  ["01", "选套餐", "按预算、地区、流量场景先筛一轮，减少来回沟通。"],
  ["02", "做预检", "核对年龄、实名、地址、禁发区和首充要求。"],
  ["03", "交客服", "把咨询单交给客服 Agent，由人工或本地模型跟进。"],
  ["04", "接 API", "后续把套餐、价格、选号和订单状态接到 172 后台。"],
];

const faqs = [
  {
    q: "这些套餐现在是真实在售吗？",
    a: "当前页面使用演示套餐位，方便你先确认前端结构。上线前应以 172 后台或运营商审核结果为准。",
  },
  {
    q: "为什么要先做办卡预检？",
    a: "流量卡常见失败点在地区、年龄、实名、首充和重复下单。把限制条件前置，能显著降低无效咨询。",
  },
  {
    q: "后续能接入真实客服吗？",
    a: "可以。页面已经保留咨询单和对话入口，后续可以接本地客服 Agent、企业微信或表单系统。",
  },
];

const quickReplies = ["想要大流量", "先查禁发区", "首充规则怎么确认", "我想选号码"];

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.12 },
    );

    document.querySelectorAll("[data-reveal]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function useMouseParallax() {
  useEffect(() => {
    const target = document.querySelector(".hero-stage");
    if (!target) return undefined;

    const onMove = (event) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      target.style.setProperty("--mx", `${x * 14}px`);
      target.style.setProperty("--my", `${y * 10}px`);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
}

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <a className="brand" href="#top" aria-label="返回顶部">
        <span className="brand-mark" aria-hidden="true">
          <Signal size={20} strokeWidth={2.4} />
        </span>
        <span>电话卡娘</span>
      </a>
      <nav className="nav-links" aria-label="主导航">
        <a href="#plans">套餐</a>
        <a href="#precheck">预检</a>
        <a href="#flow">流程</a>
        <a href="#service">客服</a>
      </nav>
      <a className="header-action" href="#consult">
        <MessageCircle size={18} />
        咨询办理
      </a>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero band" id="top">
      <div className="hero-copy" data-reveal>
        <h1>电话卡娘</h1>
        <p className="hero-lead">
          把流量卡里最容易踩坑的套餐规则、禁发地区、首充要求和激活流程讲清楚，再把有效咨询交给客服 Agent 跟进。
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#plans">
            <WalletCards size={18} />
            查看热门套餐
          </a>
          <a className="button secondary" href="#precheck">
            <SlidersHorizontal size={18} />
            先做办卡预检
          </a>
        </div>
        <div className="hero-points" aria-label="服务要点">
          {precheckCards.map(({ icon: Icon, title, text }) => (
            <article className="mini-card" key={title}>
              <Icon size={18} />
              <strong>{title}</strong>
              <span>{text}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-visual" data-reveal>
        <div className="hero-stage">
          <div className="hero-frame">
            <img src="/assets/mascot-front.png" alt="电话卡娘拟人通信卡角色" />
          </div>
          <div className="plan-board" aria-label="当前推荐套餐">
            <div className="board-head">
              <span>Live Plan Board</span>
              <strong>5G</strong>
            </div>
            <div className="board-body">
              <span>当前推荐</span>
              <strong>追番畅享卡</strong>
            </div>
            <div className="board-metrics">
              <span>
                <strong>180G</strong>
                月流量
              </span>
              <span>
                <strong>39</strong>
                元/月起
              </span>
            </div>
          </div>
          <div className="signal-chip">
            <RadioTower size={16} />
            稳定通信
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanStudio() {
  const [active, setActive] = useState("all");
  const visiblePlans = useMemo(
    () => (active === "all" ? plans : plans.filter((plan) => plan.category === active)),
    [active],
  );

  return (
    <section className="section band" id="plans" data-reveal>
      <div className="section-heading split">
        <div>
          <p className="section-kicker">PLAN STUDIO</p>
          <h2>热门流量套餐</h2>
        </div>
        <p>
          这里先放入可替换套餐展示位。拿到 172 官方 API 后，商品、价格、禁发区和办理规则可以由接口同步。
        </p>
      </div>

      <div className="filter-row" aria-label="套餐筛选">
        <Filter size={18} />
        {filters.map((filter) => (
          <button
            className={active === filter.id ? "is-active" : ""}
            key={filter.id}
            onClick={() => setActive(filter.id)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="plans-grid">
        {visiblePlans.map((plan) => (
          <article className={`plan-card tone-${plan.tone}`} key={plan.id}>
            <div className="plan-topline">
              <span>{plan.label}</span>
              <PackageCheck size={18} />
            </div>
            <h3>{plan.name}</h3>
            <p className="plan-fit">{plan.fit}</p>
            <div className="plan-price">
              <strong>{plan.monthly}</strong>
              <span>元/月起</span>
            </div>
            <dl className="plan-specs">
              <div>
                <dt>流量</dt>
                <dd>{plan.data}</dd>
              </div>
              <div>
                <dt>语音</dt>
                <dd>{plan.voice}</dd>
              </div>
              <div>
                <dt>线路</dt>
                <dd>{plan.carrier}</dd>
              </div>
            </dl>
            <ul className="plan-notes">
              {plan.notes.map((note) => (
                <li key={note}>
                  <CheckCircle2 size={15} />
                  {note}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function Precheck() {
  const [form, setForm] = useState({
    city: "",
    age: "",
    budget: "39",
    need: "large",
  });

  const result = useMemo(() => {
    const city = form.city.trim();
    const age = Number(form.age);
    if (!city && !age) {
      return {
        tone: "idle",
        title: "先填地区和年龄",
        text: "预检会把高风险条件提前标出来，方便客服继续核对。",
      };
    }
    if (age && (age < 18 || age > 65)) {
      return {
        tone: "warning",
        title: "年龄需要人工复核",
        text: "多数流量卡对实名年龄有区间要求，建议先让客服核对可办范围。",
      };
    }
    if (/新疆|西藏|云南|广西|海南|内蒙古/.test(city)) {
      return {
        tone: "warning",
        title: "地区可能存在限制",
        text: "该地区常见禁发或审核差异，建议先查 172 后台规则再推荐套餐。",
      };
    }
    return {
      tone: "ready",
      title: "可以进入套餐匹配",
      text: "基础条件看起来可继续沟通，下一步确认首充、实名和收货信息。",
    };
  }, [form]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  return (
    <section className="precheck band" id="precheck" data-reveal>
      <div className="precheck-layout">
        <div className="section-heading">
          <p className="section-kicker">BEFORE ORDER</p>
          <h2>办卡前先查四件事</h2>
          <p>流量卡不是只看月租和 G 数。把限制条件前置，咨询路径会短很多。</p>
        </div>

        <form className="precheck-tool" aria-label="办卡预检表单">
          <label>
            所在地区
            <input value={form.city} onChange={update("city")} placeholder="例如：广东深圳" />
          </label>
          <label>
            实名年龄
            <input type="number" value={form.age} onChange={update("age")} placeholder="例如：28" />
          </label>
          <label>
            月预算
            <select value={form.budget} onChange={update("budget")}>
              <option value="19">19 元左右</option>
              <option value="29">29 元左右</option>
              <option value="39">39 元左右</option>
              <option value="49">49 元以上</option>
            </select>
          </label>
          <label>
            主要用途
            <select value={form.need} onChange={update("need")}>
              <option value="large">刷视频 / 追剧</option>
              <option value="work">办公 / 热点</option>
              <option value="backup">家人副卡</option>
              <option value="game">游戏 / 直播</option>
            </select>
          </label>
          <div className={`precheck-result ${result.tone}`} role="status">
            <ClipboardCheck size={22} />
            <div>
              <strong>{result.title}</strong>
              <span>{result.text}</span>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

function Flow() {
  return (
    <section className="section band" id="flow" data-reveal>
      <div className="section-heading split">
        <div>
          <p className="section-kicker">ORDER FLOW</p>
          <h2>从咨询到接入 API</h2>
        </div>
        <p>页面先承担前端导购和线索收集，等接口到位后再把下单、选号和回传状态接进来。</p>
      </div>
      <div className="flow-rail">
        {flowSteps.map(([num, title, text]) => (
          <article className="flow-step" key={num}>
            <span>{num}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Service() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "你好，我是电话卡娘。你可以先告诉我地区、预算和流量需求，我会先提醒需要核对的规则。",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const logRef = useRef(null);

  const send = (text) => {
    const content = text.trim();
    if (!content) return;

    setMessages((current) => [
      ...current,
      { role: "user", text: content },
      {
        role: "assistant",
        text: "收到。建议先核对可办地区、实名年龄、首充规则和是否需要选号，再给你匹配套餐。",
      },
    ]);
    setDraft("");
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="service band" id="service" data-reveal>
      <div className="section-heading split">
        <div>
          <p className="section-kicker">LOCAL AGENT</p>
          <h2>客服咨询台</h2>
        </div>
        <p>先用本地状态模拟真实咨询路径，后续可以接客服 Agent、企业微信或表单系统。</p>
      </div>

      <div className="service-layout">
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-avatar">
              <Bot size={20} />
            </span>
            <div>
              <strong>电话卡娘客服</strong>
              <span>本地演示对话</span>
            </div>
          </div>
          <div className="chat-log" ref={logRef}>
            {messages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                {message.text}
              </div>
            ))}
          </div>
          <div className="quick-replies">
            {quickReplies.map((reply) => (
              <button key={reply} onClick={() => send(reply)} type="button">
                {reply}
              </button>
            ))}
          </div>
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="输入你想咨询的套餐或地区"
            />
            <button aria-label="发送消息" type="submit">
              <SendHorizontal size={18} />
            </button>
          </form>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <article className={`faq-item${openFaq === index ? " is-open" : ""}`} key={faq.q}>
              <button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} type="button">
                {faq.q}
                <ChevronDown size={18} />
              </button>
              <div className="faq-answer">
                <p>{faq.a}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Consult() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="consult band" id="consult" data-reveal>
      <div className="consult-copy">
        <p className="section-kicker">CONSULT SHEET</p>
        <h2>把需求交给电话卡娘</h2>
        <p>填写地区、预算和使用场景，客服 Agent 后续先查规则再推荐。当前表单为前端演示状态。</p>
      </div>
      <form
        className="consult-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          window.setTimeout(() => setSubmitted(false), 2600);
        }}
      >
        <input placeholder="所在地区，例如：广东深圳" />
        <input placeholder="月预算，例如：39 元左右" />
        <select defaultValue="video">
          <option value="video">刷视频 / 追剧</option>
          <option value="work">办公 / 热点</option>
          <option value="game">游戏 / 直播</option>
          <option value="family">家人副卡</option>
        </select>
        <button className="button primary" type="submit">
          <Smartphone size={18} />
          {submitted ? "已生成咨询单" : "生成咨询单"}
        </button>
      </form>
    </section>
  );
}

function Tweaks() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", dark);
    document.documentElement.classList.toggle("density-compact", compact);
  }, [dark, compact]);

  return (
    <>
      <button className="tweaks-trigger" onClick={() => setOpen((value) => !value)} aria-label="打开设计微调" type="button">
        <Palette size={20} />
      </button>
      <div className={`tweaks-panel${open ? " is-open" : ""}`}>
        <strong>Tweaks</strong>
        <label>
          夜间模式
          <input checked={dark} onChange={(event) => setDark(event.target.checked)} type="checkbox" />
        </label>
        <label>
          紧凑密度
          <input checked={compact} onChange={(event) => setCompact(event.target.checked)} type="checkbox" />
        </label>
      </div>
    </>
  );
}

export function App() {
  useReveal();
  useMouseParallax();

  return (
    <>
      <Header />
      <main>
        <Hero />
        <PlanStudio />
        <Precheck />
        <Flow />
        <Service />
        <Consult />
      </main>
      <footer className="site-footer">
        <strong>电话卡娘</strong>
        <span>套餐信息、禁发地区、首充和结算规则以后续 172 后台数据为准。</span>
      </footer>
      <Tweaks />
    </>
  );
}
