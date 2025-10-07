/* HTML Quest v2
   - Scrollable vertical map with biomes
   - Increasing node XP requirements and harder questions per node
   - Questions loop/shuffle until node's XP bar is full
   - Local progress saved in localStorage under 'hq_v2_state'
*/

/* ---------- CONFIG ---------- */
const NODE_COUNT = 30;          // increased nodes to 30
const BASE_NODE_XP = 100;       
const EXTRA_XP_PER_NODE = 25;   
const XP_PER_CORRECT = 25;      
const STATE_KEY = 'hq_v2_state';

/* ---------- QUESTION POOLS BY DIFFICULTY ---------- */
const POOLS = {
  easy: [
    { q: "What does HTML stand for?", opts: ["Hyper Text Markup Language","Home Tool Markup Language","Hyperlinks and Text Markup Language"], a:0 },
    { q: "Which tag is used for a paragraph?", opts: ["<p>","<para>","<pg>"], a:0 },
    { q: "Which tag inserts an image?", opts: ["<img>","<image>","<src>"], a:0 },
    { q: "Which tag creates a hyperlink?", opts: ["<link>","<a>","<href>"], a:1 },
    { q: "Which tag creates an unordered list?", opts: ["<ol>","<ul>","<li>"], a:1 }
  ],
  medium: [
    { q: "Which attribute contains the URL for a link?", opts: ["href","src","alt"], a:0 },
    { q: "Where does the <title> tag belong?", opts: ["<head>","<body>","<footer>"], a:0 },
    { q: "Which tag groups table rows?", opts: ["<tr>","<td>","<th>"], a:0 },
    { q: "What's the semantic tag for main content?", opts: ["<main>","<section>","<div>"], a:0 },
    { q: "How do you make text bold in HTML?", opts: ["<b>","<strong>","Both are acceptable"], a:2 }
  ],
  hard: [
    { q: "Which attribute provides alternate text for images?", opts: ["alt","title","caption"], a:0 },
    { q: "Which tag is used for embedding a video (HTML5)?", opts: ["<video>","<media>","<embed>"], a:0 },
    { q: "Which tag should contain site navigation links?", opts: ["<nav>","<header>","<aside>"], a:0 },
    { q: "What is ARIA used for?", opts: ["Accessibility features","Styling elements","Database connections"], a:0 },
    { q: "Which element is best for marking up a self-contained composition?", opts: ["<article>","<div>","<section>"], a:0 }
  ],
  expert: [
    { q: "What's the purpose of the 'rel' attribute on <link> tags?", opts: ["Defines relationship/behavior","Refers to remote resources only","Sets rendering mode"], a:0 },
    { q: "Which attribute makes an input required in a form?", opts: ["required","must","validate"], a:0 },
    { q: "Which tag group is valid inside <table> (HTML5)?", opts: ["<caption>, <thead>, <tbody>, <tfoot>","<section>, <article>","<nav>, <aside>"], a:0 },
    { q: "Which meta tag sets the viewport for responsive design?", opts: ['<meta name="viewport" content="width=device-width, initial-scale=1">','<meta name="size">','<meta name="responsive">'], a:0 },
    { q: "When should you use <button type='submit'> vs <a> links?", opts: ["Forms submit use button, navigation use <a>","Both are interchangeable","Use <a> for everything"], a:0 }
  ]
};

/* ---------- DIFFICULTY MAPPING ---------- */
function difficultyForNode(i){
  if (i < 8) return 'easy';
  if (i < 16) return 'medium';
  if (i < 24) return 'hard';
  return 'expert';
}

/* ---------- STATE ---------- */
let state = loadState();

function defaultState(){
  const nodes = Array.from({length: NODE_COUNT}, (_,i) => ({
    index: i,
    xp: 0,
    completed: false,
    unlocked: i === 0
  }));
  return { nodes, currentNode: 0 };
}

function loadState(){
  const raw = localStorage.getItem(STATE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch(e){}
  }
  return defaultState();
}

function saveState(){
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

/* ---------- UI REFS ---------- */
const mapWrap = document.getElementById('map-wrap');
const nodesContainer = document.getElementById('nodes-container');
const pathEl = document.getElementById('path');

const quizModal = document.getElementById('quiz-modal');
const questionText = document.getElementById('question-text');
const optionsDiv = document.getElementById('options');
const feedbackEl = document.getElementById('feedback');
const nodeProgressEl = document.getElementById('node-progress');
const nodeXpText = document.getElementById('node-xp');
const nodeXpReqText = document.getElementById('node-xp-required');
const quizNodeNumber = document.getElementById('quiz-node-number');
const quizDifficulty = document.getElementById('quiz-difficulty');
const closeQuizBtn = document.getElementById('close-quiz');
const currentNodeDisplay = document.getElementById('current-node-display');
const globalXpDisplay = document.getElementById('global-xp');

/* ---------- HELPERS ---------- */
function shuffled(arr){ return arr.slice().map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.v); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function nodeXpRequired(i){ return BASE_NODE_XP + (i * EXTRA_XP_PER_NODE); }

/* ---------- RENDER MAP ---------- */
function renderMap() {
  nodesContainer.innerHTML = '';

  const total = state.nodes.length;
  const verticalGap = 120; // smaller gap for 30 nodes
  const baseY = 120;
  const totalHeight = baseY + (total - 1) * verticalGap + 300;

  pathEl.style.height = totalHeight + "px";

  addBiomes(totalHeight);

  const positions = [];
  for (let i = 0; i < total; i++) {
    const x = (i % 3 === 0) ? 30 : (i % 3 === 1 ? 70 : 50);
    const y = baseY + i * verticalGap;
    positions.push({ x, y });
  }

  state.nodes.forEach((node, i) => {
    const el = document.createElement('div');
    el.className = 'node ' + (node.completed ? 'completed' : (node.unlocked ? 'unlocked' : 'locked'));
    el.style.left = positions[i].x + '%';
    el.style.top = positions[i].y + 'px';
    el.dataset.index = i;
    el.title = node.completed ? 'Completed' : (node.unlocked ? `Node ${i + 1} — Click to practice` : 'Locked');

    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = i + 1;
    el.appendChild(num);

    const xpBadge = document.createElement('div');
    xpBadge.className = 'xp-badge';
    xpBadge.textContent = `${node.xp}/${nodeXpRequired(i)} XP`;
    el.appendChild(xpBadge);

    el.addEventListener('click', () => {
      if (!node.unlocked) {
        el.animate(
          [
            { transform: 'translate(-50%, -50%)' },
            { transform: 'translate(-46%, -50%)' },
            { transform: 'translate(-50%, -50%)' }
          ],
          { duration: 240 }
        );
        return;
      }
      openQuiz(i);
    });

    nodesContainer.appendChild(el);
  });

  updateHeaderStats();
}

/* ---------- BIOMES ---------- */
function addBiomes(totalHeight) {
  // Make #path a positioned container for absolute children
  pathEl.style.position = 'relative';
  pathEl.style.overflow = 'hidden';
  pathEl.style.height = totalHeight + 'px';

  // Remove previous biome elements
  const existing = pathEl.querySelectorAll('.biome-row, .night-element');
  existing.forEach(e => e.remove());

  const total = state.nodes.length;
  const pathW = pathEl.clientWidth; // get actual pixel width of the path

  for (let i = 0; i < total; i++) {
    const yPos = 120 + i * 120;

    if (i < 15) {
  // 🌳 DAYTIME (trees & bushes) — fully random positions like stars/clouds
  for (let j = 0; j < 2; j++) {
    const treeLeft = (10 + Math.random() * 80) / 100 * pathW;
    const treeTop  = yPos + Math.random() * 20;
    const tree = document.createElement('div');
    tree.className = 'biome-row';
    tree.style.position = 'absolute';
    tree.style.left = `${treeLeft}px`;
    tree.style.top = `${treeTop}px`;
    tree.innerHTML = smallTreeSVG(i + j);
    pathEl.appendChild(tree);
  }

  const bushLeft = (10 + Math.random() * 80) / 100 * pathW;
  const bushTop  = yPos + Math.random() * 20;
  const bush = document.createElement('div');
  bush.className = 'biome-row';
  bush.style.position = 'absolute';
  bush.style.left = `${bushLeft}px`;
  bush.style.top = `${bushTop}px`;
  bush.innerHTML = smallBushSVG(i);
  pathEl.appendChild(bush);

    } else {
      // 🌙 NIGHTTIME (clouds & stars)
      for (let j = 0; j < 3; j++) {
        const cloudLeft = (10 + Math.random() * 80) / 100 * pathW;
        const starLeft  = (10 + Math.random() * 80) / 100 * pathW;

        // Cloud
        const cloud = document.createElement('div');
        cloud.className = 'night-element';
        cloud.style.position = 'absolute';
        cloud.style.left = `${cloudLeft}px`;
        cloud.style.top = `${yPos - 50 + Math.random() * 100}px`;
        cloud.style.transform = 'translateX(-50%)';
        cloud.innerHTML = cloudSVG(i + j);
        pathEl.appendChild(cloud);

        // Star
        const star = document.createElement('div');
        star.className = 'night-element';
        star.style.position = 'absolute';
        star.style.left = `${starLeft}px`;
        star.style.top = `${yPos - 80 + Math.random() * 120}px`;
        star.style.transform = 'translateX(-50%)';
        star.innerHTML = starSVG(i + j);
        pathEl.appendChild(star);
      }
    }
  }
}



// Star SVG helper
function starSVG(seed = 0) {
    const size = 4 + (seed % 3) * 2;
    const color = "#1688ebff";
    return `
        <svg width="${size}" height="${size}" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <circle cx="5" cy="5" r="5" fill="${color}" />
        </svg>
    `;
}

/* ---------- SVG HELPERS ---------- */
function cloudSVG(seed=0){
  const scale = 1 + (seed % 3) * 0.2;
  return `<svg width="${80*scale}" height="${40*scale}" viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <ellipse cx="20" cy="20" rx="20" ry="12" fill="#e0f7ff"/>
    <ellipse cx="40" cy="16" rx="25" ry="14" fill="#ccefff"/>
    <ellipse cx="60" cy="22" rx="18" ry="10" fill="#d6f0ff"/>
  </svg>`;
}

function smallTreeSVG(seed=0){
  const scale = 0.9 + ((seed%3)*0.12);
  return `<svg width="${64*scale}" height="${84*scale}" viewBox="0 0 64 84" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="28" y="58" width="8" height="18" rx="2" fill="#7b4f2a"/>
    <ellipse cx="32" cy="40" rx="22" ry="20" fill="#8bd26f"/>
    <ellipse cx="20" cy="34" rx="12" ry="11" fill="#7bd266"/>
    <ellipse cx="44" cy="34" rx="12" ry="11" fill="#a3e37f"/>
  </svg>`;
}

function smallBushSVG(seed=0){
  const scale = 0.75 + ((seed%2)*0.15);
  return `<svg width="${80*scale}" height="${40*scale}" viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <ellipse cx="20" cy="24" rx="18" ry="12" fill="#a7f3d0"/>
    <ellipse cx="44" cy="20" rx="20" ry="14" fill="#9ee7b6"/>
    <ellipse cx="64" cy="26" rx="14" ry="10" fill="#c9f7cf"/>
  </svg>`;
}

/* ---------- QUIZ LOGIC ---------- */
let quizPool = [];
let currentQuizNodeIdx = 0;
let quizNode = null;

function openQuiz(nodeIndex){
  currentQuizNodeIdx = nodeIndex;
  quizNode = state.nodes[nodeIndex];
  state.currentNode = nodeIndex;
  saveState();
  quizPool = shuffled(POOLS[difficultyForNode(nodeIndex)]);
  showQuizUI();
  presentNextQuestion();
}

closeQuizBtn.addEventListener('click', ()=> {
  quizModal.classList.add('hidden');
  renderMap();
});

function showQuizUI(){
  quizModal.classList.remove('hidden');
  quizNodeNumber.textContent = currentQuizNodeIdx + 1;
  quizDifficulty.textContent = difficultyForNode(currentQuizNodeIdx).toUpperCase();
  nodeXpReqText.textContent = nodeXpRequired(currentQuizNodeIdx);
  updateNodeProgressUI();
  feedbackEl.textContent = '';
  questionText.textContent = '';
  optionsDiv.innerHTML = '';
  quizModal.setAttribute('aria-hidden','false');
}

function presentNextQuestion(){
  if (quizPool.length === 0) {
    quizPool = shuffled(POOLS[difficultyForNode(currentQuizNodeIdx)]);
  }
  displayQuestion(quizPool.shift());
}

function displayQuestion(q){
  questionText.textContent = q.q;
  optionsDiv.innerHTML = '';
  q.opts.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', ()=> handleAnswer(q, idx, btn));
    optionsDiv.appendChild(btn);
  });
}

function handleAnswer(q, selectedIndex, btnEl){
  const correct = q.a;
  if (selectedIndex === correct) {
    btnEl.classList.add('correct');
    feedbackEl.textContent = '✅ Correct!';
    const needed = nodeXpRequired(currentQuizNodeIdx);
    quizNode.xp = clamp(quizNode.xp + XP_PER_CORRECT, 0, needed);
    saveState();
    updateNodeProgressUI();
    if (quizNode.xp >= needed) {
      quizNode.completed = true;
      const next = state.nodes[currentQuizNodeIdx + 1];
      if (next) next.unlocked = true;
      saveState();
      launchConfetti();
      setTimeout(()=> {
        quizModal.classList.add('hidden');
        renderMap();
      }, 900);
      return;
    }
    setTimeout(()=> {
      feedbackEl.textContent = '';
      presentNextQuestion();
    }, 650);
  } else {
    btnEl.classList.add('wrong');
    feedbackEl.textContent = '❌ Try another one!';
    setTimeout(()=> {
      feedbackEl.textContent = '';
      presentNextQuestion();
    }, 700);
  }
}

/* ---------- PROGRESS & HEADER ---------- */
function updateNodeProgressUI(){
  const needed = nodeXpRequired(currentQuizNodeIdx);
  nodeProgressEl.style.width = `${(quizNode.xp / needed) * 100}%`;
  nodeXpText.textContent = `${quizNode.xp}`;
  nodeXpReqText.textContent = `${needed}`;
  currentNodeDisplay.textContent = state.currentNode + 1;
  const totalXP = state.nodes.reduce((s,n)=> s+n.xp, 0);
  globalXpDisplay.textContent = totalXP;
}

/* ---------- CONFETTI ---------- */
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas.getContext ? confettiCanvas.getContext('2d') : null;
let confPieces = [];
function resizeCanvas(){ confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight; }
resizeCanvas(); window.addEventListener('resize', resizeCanvas);

function launchConfetti(){
  if (!confettiCtx) return;
  confPieces = [];
  const count = 70;
  for (let i=0;i<count;i++){
    confPieces.push({
      x: innerWidth/2 + (Math.random()*500-250),
      y: innerHeight/2 - 80 + (Math.random()*40-20),
      vx: (Math.random()-0.5)*6,
      vy: Math.random()*-6 - 2,
      size: Math.random()*8+4,
      rot: Math.random()*360,
      color: randomColor()
    });
  }
  requestAnimationFrame(drawConf);
  setTimeout(()=> confPieces = [], 1800);
}
function randomColor(){
  const palette = ['#8bd26f','#f6e05e','#34d399','#60a5fa','#a78bfa','#f472b6'];
  return palette[Math.floor(Math.random()*palette.length)];
}
function drawConf(){
  if (!confettiCtx) return;
  confettiCtx.clearRect(0,0, confettiCanvas.width, confettiCanvas.height);
  if (confPieces.length === 0) return;
  confPieces.forEach((p, idx) => {
    p.x += p.vx;
    p.y += (p.vy += 0.18);
    p.rot += p.vx*4;
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot * Math.PI/180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
    confettiCtx.restore();
    if (p.y > innerHeight + 60) confPieces.splice(idx,1);
  });
  if (confPieces.length>0) requestAnimationFrame(drawConf);
}

/* ---------- INIT ---------- */
renderMap();
window.addEventListener('resize', ()=> { renderMap(); });
window.addEventListener('beforeunload', ()=> saveState());
