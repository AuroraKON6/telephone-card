const plans = [
  {
    id: "aurora",
    filter: "large",
    tone: "blue",
    label: "当前推荐",
    name: "极光追番卡",
    fit: "视频、直播、热点共享",
    data: "180G",
    price: "39",
    carrier: "电信 / 联通",
    rule: "首充规则待同步，禁发区需预检",
  },
  {
    id: "commute",
    filter: "budget",
    tone: "gold",
    label: "低月租",
    name: "星蓝通勤卡",
    fit: "导航、短视频、轻办公",
    data: "135G",
    price: "29",
    carrier: "电信 / 广电",
    rule: "适合日常副卡，规则清晰",
  },
  {
    id: "work",
    filter: "work",
    tone: "cyan",
    label: "办公热点",
    name: "云端办公卡",
    fit: "外勤、移动办公、备用热点",
    data: "220G",
    price: "49",
    carrier: "联通 / 电信",
    rule: "建议先查热点共享限制",
  },
  {
    id: "guard",
    filter: "budget",
    tone: "rose",
    label: "家人副卡",
    name: "长期守护卡",
    fit: "家人备用机、低预算咨询",
    data: "100G",
    price: "19",
    carrier: "运营商可选",
    rule: "适合备用机和家人副卡",
  },
];

const mascotLines = [
  "告诉我你的地区和预算，我先帮你避开办卡坑点。",
  "鼠标靠近时，我会跟着你看套餐细节。",
  "首充、禁发区、激活方式，建议都先查一遍。",
  "如果你要大流量，我会优先核对热点和限速规则。",
];

const planGallery = document.querySelector("#planGallery");
const filterButtons = document.querySelectorAll("[data-filter]");
const cityInput = document.querySelector("#cityInput");
const ageInput = document.querySelector("#ageInput");
const precheckResult = document.querySelector("#precheckResult");
const chatForm = document.querySelector("#chatForm");
const chatDraft = document.querySelector("#chatDraft");
const chatLog = document.querySelector("#chatLog");
const mascotLine = document.querySelector("#mascotLine");
const gazeLabel = document.querySelector("#gazeLabel");
const trackingToggle = document.querySelector("#trackingToggle");
const tweaks = document.querySelector("#tweaksPanel");
const mascotPortrait = document.querySelector("#mascotPortrait");
const scrollCompanion = document.querySelector("#scrollCompanion");
const companionLine = document.querySelector("#companionLine");
let emotionTimer = 0;
let lineIndex = 0;
let lastScrollY = window.scrollY;
let tsundereReleaseTimer = 0;
let ignoreScrollUntil = 0;

function sayMascot(text) {
  mascotLine.textContent = text;
  if (companionLine) companionLine.textContent = text;
}

function setEmotion(emotion, line, hold = 0) {
  window.clearTimeout(emotionTimer);
  document.body.dataset.emotion = emotion;
  if (line) sayMascot(line);

  if (hold > 0) {
    emotionTimer = window.setTimeout(() => {
      document.body.dataset.emotion = "idle";
    }, hold);
  }
}

function smileMascot() {
  ignoreScrollUntil = Date.now() + 1100;
  document.body.classList.remove("mascot-tap");
  void document.body.offsetWidth;
  document.body.classList.add("mascot-tap");
  setEmotion("smile", "哼，既然你点我了，那我就认真帮你看套餐吧。", 2600);
  gazeLabel.textContent = "笑了一下";
}

function setupMascotEmotion() {
  mascotPortrait.addEventListener("click", smileMascot);
  scrollCompanion.addEventListener("click", smileMascot);
  mascotPortrait.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      smileMascot();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      const current = window.scrollY;
      const goingDown = current > lastScrollY + 10;
      lastScrollY = current;

      if (Date.now() < ignoreScrollUntil) return;

      if (goingDown && current > 120) {
        window.clearTimeout(tsundereReleaseTimer);
        setEmotion("tsundere", "喂，别划太快啦。套餐规则还没看完呢，真是的。", 0);
        gazeLabel.textContent = "有点傲娇";
        tsundereReleaseTimer = window.setTimeout(() => {
          if (document.body.dataset.emotion === "tsundere") {
            document.body.dataset.emotion = "idle";
            sayMascot("好吧，继续看也可以。我会把重点给你留着。");
          }
        }, 2200);
      }
    },
    { passive: true },
  );
}

function renderPlans(filter = "all") {
  const visible = filter === "all" ? plans : plans.filter((plan) => plan.filter === filter);
  planGallery.innerHTML = visible
    .map(
      (plan) => `
        <article class="plan-card" data-tone="${plan.tone}">
          <span class="plan-label">${plan.label}</span>
          <h3>${plan.name}</h3>
          <p class="plan-fit">${plan.fit}</p>
          <div class="plan-price">
            <strong>${plan.price}</strong>
            <span>元 / 月起</span>
          </div>
          <div class="plan-specs">
            <div><span>月流量</span><strong>${plan.data}</strong></div>
            <div><span>运营商</span><strong>${plan.carrier}</strong></div>
            <div><span>提醒</span><strong>${plan.rule}</strong></div>
          </div>
        </article>
      `,
    )
    .join("");
}

function runPrecheck() {
  const city = cityInput.value.trim();
  const age = Number(ageInput.value);
  precheckResult.className = "precheck-result";

  if (!city && !age) {
    precheckResult.classList.add("idle");
    precheckResult.innerHTML = `
      <strong>等待输入地区和年龄</strong>
      <span>电话卡娘会先看禁发区、年龄、首充和重复下单风险。</span>
    `;
    return;
  }

  if (age && (age < 18 || age > 65)) {
    precheckResult.classList.add("danger");
    precheckResult.innerHTML = `
      <strong>年龄需要人工复核</strong>
      <span>多数号卡对实名年龄有区间要求，建议先让客服核对可办范围。</span>
    `;
    setEmotion("tsundere", "这个年龄段要谨慎，我会先提醒客服人工复核。", 1800);
    return;
  }

  if (/新疆|西藏|云南|广西|海南|内蒙古/.test(city)) {
    precheckResult.classList.add("warn");
    precheckResult.innerHTML = `
      <strong>地区可能存在限制</strong>
      <span>该地区常见禁发或审核差异，建议先查 172 后台规则再推荐套餐。</span>
    `;
    setEmotion("tsundere", "这个地区我会先标记为需查规则，不急着下单。", 1800);
    return;
  }

  precheckResult.classList.add("ready");
  precheckResult.innerHTML = `
    <strong>可以进入套餐匹配</strong>
    <span>基础条件看起来可继续沟通，下一步确认首充、实名和收货信息。</span>
  `;
  setEmotion("smile", "基础条件看起来不错，我可以继续帮你匹配套餐。", 1800);
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  chatLog.appendChild(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function sendChat(text) {
  const content = text.trim();
  if (!content) return;
  addMessage("user", content);
  addMessage("assistant", "收到。我会先核对地区、年龄、首充入口和激活方式，再把咨询单交给客服跟进。");
  setEmotion("smile", "我已经把咨询重点记下来了。", 1700);
}

function setupMouseTracking() {
  const root = document.documentElement;
  const stage = document.querySelector(".mascot-card");

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!trackingToggle.checked || !stage) return;
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = Math.max(-1, Math.min(1, (event.clientX - centerX) / (rect.width / 2)));
      const dy = Math.max(-1, Math.min(1, (event.clientY - centerY) / (rect.height / 2)));

      root.style.setProperty("--look-x", `${dx * 12}px`);
      root.style.setProperty("--look-y", `${dy * 9}px`);
      root.style.setProperty("--tilt-x", `${dx * 4.4}deg`);
      root.style.setProperty("--tilt-y", `${dy * -3.2}deg`);

      const horizontal = dx < -0.28 ? "左侧" : dx > 0.28 ? "右侧" : "正前方";
      const vertical = dy < -0.25 ? "上方" : dy > 0.25 ? "下方" : "";
      gazeLabel.textContent = `看向${vertical}${horizontal}`;
    },
    { passive: true },
  );

  window.setInterval(() => {
    lineIndex = (lineIndex + 1) % mascotLines.length;
    if (document.activeElement !== chatDraft && document.body.dataset.emotion !== "tsundere") {
      sayMascot(mascotLines[lineIndex]);
    }
  }, 5800);
}

function setupCounters() {
  document.querySelectorAll("[data-count]").forEach((node) => {
    const target = Number(node.dataset.count);
    const start = performance.now();
    const duration = 760;

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

function setupReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    },
    { threshold: 0.1 },
  );

  document.querySelectorAll("[data-reveal]").forEach((node) => observer.observe(node));
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderPlans(button.dataset.filter);
  });
});

[cityInput, ageInput].forEach((field) => field.addEventListener("input", runPrecheck));

document.querySelectorAll(".quick-replies button").forEach((button) => {
  button.addEventListener("click", () => sendChat(button.textContent));
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendChat(chatDraft.value);
  chatDraft.value = "";
});

document.querySelector("#tweaksToggle").addEventListener("click", () => {
  tweaks.classList.toggle("open");
});

document.querySelector("#modeSelect").addEventListener("change", (event) => {
  document.body.dataset.mode = event.target.value;
});

document.querySelector("#densitySelect").addEventListener("change", (event) => {
  document.body.dataset.density = event.target.value;
});

trackingToggle.addEventListener("change", () => {
  if (!trackingToggle.checked) {
    document.documentElement.style.setProperty("--look-x", "0px");
    document.documentElement.style.setProperty("--look-y", "0px");
    document.documentElement.style.setProperty("--tilt-x", "0deg");
    document.documentElement.style.setProperty("--tilt-y", "0deg");
    gazeLabel.textContent = "跟随已暂停";
  }
});

renderPlans();
setupReveal();
setupCounters();
setupMouseTracking();
setupMascotEmotion();
