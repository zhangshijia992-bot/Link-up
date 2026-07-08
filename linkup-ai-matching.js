let appData = { users: [], teams: [], competitions: [], conversations: [], chat_messages: [], competition_entries: [] };
let currentMode = "individual";
let searchType = "people";
let selectedTeamId = "";
let currentRecruitRole = "";
let appliedIntent = null;
let manualFilters = { role: "", skill: "", project: "", institution: "" };
let requestFilter = "all";
let activeChatIndex = null;
let chatPoller = null;
let activeCall = null;
let activeCompetitionIndex = 0;
let introIndex = 0;
let introPlaying = false;
let introMuted = false;
let activeSpeechSource = "";
let speechToken = 0;
let suppressNextAssistantClick = false;
let assistantDragState = null;
let authToken = localStorage.getItem("linkup_auth_token") || "";
let pendingAuth = null;
const introSteps = [
  {
    title: "Find the right people",
    body: "Link-Up helps students move from random networking to purposeful team formation.",
    narration: "Welcome to Link-Up. This platform helps students find reliable collaborators for projects, competitions, startups, and research work.",
  },
  {
    title: "Choose a matching mode",
    body: "Use AI to find one collaborator, join a recruiting team, or recruit people for your own team.",
    narration: "In AI Matching, users can find an individual collaborator, find a team to join, or recruit teammates for an existing team.",
  },
  {
    title: "Review explainable results",
    body: "Each recommendation shows a compatibility score and explains why the match is suitable.",
    narration: "The system does not only show a match score. It also explains the reason, such as matching roles, skills, availability, and project goals.",
  },
  {
    title: "Start focused collaboration",
    body: "After both sides agree, messaging unlocks and the collaboration lifecycle can be tracked.",
    narration: "After a collaboration request is accepted, chat is unlocked. Link-Up then supports active collaboration, completion confirmation, and outcome sharing.",
  },
];
let currentProfile = {
  name: "Alex Tan",
  email: "alex.tan@linkup.demo",
  role: "Frontend Developer",
  experience: "1-2 years",
  skills: "React;Python;UI/UX",
  interests: "AI startups;Hackathons;EdTech",
  project_types: "AI Product",
  preferred_roles: "Backend Engineer;Machine Learning Engineer",
  availability: "Weekday evenings;Weekend mornings",
  working_style: "Fast responder;Collaborative member",
  communication_style: "Frequent updates;Friendly tone",
  goals: "Build MVPs;Join innovation challenges",
  bio: "Computer Science student interested in AI products, hackathons, and practical MVP building.",
  portfolio: "Campus AI Assistant;Course Planner UI;Hackathon Landing Page",
  badges: "First Collaboration;Active Contributor",
  institution: "Asia Pacific University of Technology & Innovation (APU)",
  organisation_type: "University Student",
  company: "",
  location: "Kuala Lumpur",
  study_level: "Bachelor Degree",
  major: "Computer Science",
  graduation_year: "2027",
  verification_status: "OTP verified",
  reliability_score: "86",
};
let requestState = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const projectTypes = ["AI Product", "Web App", "Mobile App", "Research Project", "Competition", "Startup", "Data Platform", "VR Experience", "Cybersecurity Tool", "E-commerce", "FinTech", "HealthTech"];
const roles = ["Frontend Developer", "Backend Engineer", "Full Stack Developer", "Machine Learning Engineer", "Data Processing Engineer", "Data Analyst", "UI/UX Designer", "Product Designer", "Product Manager", "Cloud Engineer", "DevOps Engineer", "Mobile Developer", "AR/VR Developer", "Cybersecurity Analyst", "QA Tester", "Business Analyst", "AI Prompt Engineer", "Pitch Presenter", "Content Strategist"];
const skills = ["React", "Vue", "HTML/CSS", "JavaScript", "TypeScript", "Python", "Java", "C#", "Node.js", "Express", "APIs", "SQL", "NoSQL", "MongoDB", "Cloud Database", "Firebase", "AWS", "Docker", "GitHub Actions", "TensorFlow", "PyTorch", "Machine Learning", "Data Processing", "Data Visualization", "Power BI", "Figma", "Wireframing", "Prototyping", "User Research", "Accessibility", "Flutter", "React Native", "Unity", "VR Interaction", "Cybersecurity", "Testing", "Agile", "Presentation", "Pitch Deck", "Market Research", "Documentation", "AI Prompting", "Storytelling", "Content Writing", "Social media"];
const directions = ["AI startups", "Hackathons", "EdTech", "Research", "Social impact", "Open source", "Smart campus", "HealthTech", "Sustainability", "FinTech", "E-commerce", "Cybersecurity", "Virtual reality", "Data analytics", "Accessibility", "Student productivity", "Startup validation"];
const teamStages = ["Idea validation", "User research", "Prototype building", "MVP development", "Competition preparation", "Research and report", "Pitch preparation", "Testing and QA", "Launch preparation"];
const locations = ["Kuala Lumpur", "Selangor", "Cyberjaya", "Putrajaya", "Penang", "Johor Bahru", "Melaka", "Ipoh", "Kota Kinabalu", "Kuching", "Shah Alam", "Subang Jaya", "Petaling Jaya", "Remote / Online"];
const studyLevels = ["Foundation", "Diploma", "Bachelor Degree", "Master Degree", "PhD", "Professional Certificate", "Working Professional"];
const majors = ["Computer Science", "Software Engineering", "Information Technology", "Data Science", "Cybersecurity", "Artificial Intelligence", "Business Information Systems", "Multimedia Design", "Digital Marketing", "Business Administration", "Engineering", "Finance", "Psychology", "Communication", "Other"];
const availabilityOptions = ["Weekday mornings", "Weekday afternoons", "Weekday evenings", "Weekday nights", "Weekend mornings", "Weekend afternoons", "Weekend evenings", "Flexible", "Remote only", "On-campus only"];
const graduationYears = ["2026", "2027", "2028", "2029", "2030", "2031", "2032", "Not applicable"];
const malaysiaInstitutions = [
  "Asia Pacific University of Technology & Innovation (APU)",
  "Universiti Malaya (UM)",
  "Universiti Kebangsaan Malaysia (UKM)",
  "Universiti Putra Malaysia (UPM)",
  "Universiti Sains Malaysia (USM)",
  "Universiti Teknologi Malaysia (UTM)",
  "Universiti Teknologi MARA (UiTM)",
  "Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)",
  "Universiti Malaysia Perlis (UniMAP)",
  "Universiti Malaysia Terengganu (UMT)",
  "Universiti Tun Hussein Onn Malaysia (UTHM)",
  "Universiti Teknikal Malaysia Melaka (UTeM)",
  "Universiti Sains Islam Malaysia (USIM)",
  "Universiti Sultan Zainal Abidin (UniSZA)",
  "Universiti Pertahanan Nasional Malaysia (UPNM)",
  "Universiti Malaysia Kelantan (UMK)",
  "Universiti Malaysia Sabah (UMS)",
  "Universiti Malaysia Sarawak (UNIMAS)",
  "Universiti Utara Malaysia (UUM)",
  "Universiti Pendidikan Sultan Idris (UPSI)",
  "International Islamic University Malaysia (IIUM)",
  "Universiti Islam Antarabangsa Malaysia (UIAM)",
  "Universiti Kuala Lumpur (UniKL)",
  "Universiti Selangor (UNISEL)",
  "Universiti Tenaga Nasional (UNITEN)",
  "Universiti Teknologi PETRONAS (UTP)",
  "Universiti Tun Abdul Razak (UNIRAZAK)",
  "Wawasan Open University (WOU)",
  "Open University Malaysia (OUM)",
  "Taylor's University",
  "Sunway University",
  "Monash University Malaysia",
  "University of Nottingham Malaysia",
  "Heriot-Watt University Malaysia",
  "Curtin University Malaysia",
  "Swinburne University of Technology Sarawak",
  "Newcastle University Medicine Malaysia",
  "University of Southampton Malaysia",
  "University of Reading Malaysia",
  "Raffles University",
  "Multimedia University (MMU)",
  "UCSI University",
  "INTI International University",
  "HELP University",
  "SEGi University",
  "Management and Science University (MSU)",
  "Universiti Tunku Abdul Rahman (UTAR)",
  "Tunku Abdul Rahman University of Management and Technology (TAR UMT)",
  "Xiamen University Malaysia",
  "Infrastructure University Kuala Lumpur (IUKL)",
  "University of Cyberjaya",
  "MAHSA University",
  "Quest International University",
  "Nilai University",
  "AIMST University",
  "Albukhary International University",
  "Lincoln University College",
  "City University Malaysia",
  "Binary University",
  "Limkokwing University of Creative Technology",
  "International Medical University (IMU)",
  "Asia e University (AeU)",
  "Manipal University College Malaysia",
  "Perdana University",
  "Putra Business School",
  "Malaysia University of Science and Technology (MUST)",
  "Southern University College",
  "New Era University College",
  "Han Chiang University College of Communication",
  "KDU / UOW Malaysia",
  "MILA University",
  "Geomatika University College",
  "Other / Company"
];
const roleSkillMap = {
  "Frontend Developer": ["React", "TypeScript", "HTML/CSS", "Accessibility", "APIs"],
  "Backend Engineer": ["Node.js", "Python", "SQL", "APIs", "Cloud Database"],
  "Full Stack Developer": ["React", "Node.js", "SQL", "APIs", "Docker"],
  "ML Engineer": ["Python", "TensorFlow", "PyTorch", "Machine Learning", "Data Processing"],
  "Machine Learning Engineer": ["Python", "TensorFlow", "PyTorch", "Machine Learning", "Data Processing"],
  "Data Processing Engineer": ["Python", "SQL", "Data Processing", "Data Visualization", "Cloud Database"],
  "Data Analyst": ["SQL", "Python", "Power BI", "Data Visualization", "Market Research"],
  "UI/UX Designer": ["Figma", "Wireframing", "Prototyping", "User Research", "Accessibility"],
  "Product Designer": ["Figma", "Prototyping", "User Research", "Accessibility", "Market Research"],
  "Product Manager": ["Agile", "Market Research", "Presentation", "User Research", "Pitch Deck"],
  "Cloud Engineer": ["AWS", "Docker", "Cloud Database", "GitHub Actions", "APIs"],
  "DevOps Engineer": ["Docker", "GitHub Actions", "AWS", "Testing", "Cloud Database"],
  "Mobile Developer": ["Flutter", "React Native", "APIs", "Firebase", "Testing"],
  "AR/VR Developer": ["Unity", "VR Interaction", "C#", "Prototyping", "Testing"],
  "Cybersecurity Analyst": ["Cybersecurity", "Testing", "Python", "APIs", "Documentation"],
  "QA Tester": ["Testing", "Agile", "Accessibility", "Documentation", "APIs"],
  "Business Analyst": ["Market Research", "Data Visualization", "Presentation", "Agile", "User Research"],
  "AI Prompt Engineer": ["AI Prompting", "User Research", "Python", "Presentation", "Documentation"],
  "Pitch Presenter": ["Presentation", "Pitch Deck", "Market Research", "Storytelling", "Startup validation"],
  "Content Strategist": ["Content Writing", "Market Research", "Presentation", "User Research", "Social media"],
};

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    authToken = "";
    localStorage.removeItem("linkup_auth_token");
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    showAuthView("welcome");
    $("#authStatus").textContent = "Please log in first.";
  }
  return response;
}

function populateAuthOptions() {
  fillSelect(document.querySelector('#registerForm select[name="role"]'), roles);
  fillSelect(document.querySelector('#registerForm select[name="institution"]'), malaysiaInstitutions);
  fillSelect($("#profileInstitution"), malaysiaInstitutions);
  ["#firstProfileForm", "#profileForm"].forEach((scope) => {
    fillSelect(document.querySelector(`${scope} select[name="institution"]`), malaysiaInstitutions);
    fillSelect(document.querySelector(`${scope} select[name="location"]`), locations);
    fillSelect(document.querySelector(`${scope} select[name="study_level"]`), studyLevels);
    fillSelect(document.querySelector(`${scope} select[name="major"]`), majors);
    fillSelect(document.querySelector(`${scope} select[name="graduation_year"]`), graduationYears);
    fillSelect(document.querySelector(`${scope} select[name="role"]`), roles);
    fillSelect(document.querySelector(`${scope} select[name="availability"]`), availabilityOptions);
    fillSelect(document.querySelector(`${scope} select[name="skills"]`), skills);
    fillSelect(document.querySelector(`${scope} select[name="interests"]`), directions);
  });
  enhanceProfileMultiSelects();
}

function showAuthView(view) {
  const map = {
    welcome: "authWelcome",
    login: "loginForm",
    register: "registerForm",
    otp: "otpForm",
    profile: "firstProfileForm",
  };
  const nextView = map[view] ? view : "welcome";
  Object.entries(map).forEach(([key, id]) => {
    const panel = $(`#${id}`);
    if (!panel) return;
    const isActive = key === nextView;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });
  const routeMap = {
    welcome: "#/welcome",
    login: "#/login",
    register: "#/register",
    otp: "#/verify-otp",
    profile: "#/profile-setup",
  };
  if (location.hash !== routeMap[nextView]) {
    history.pushState(null, "", routeMap[nextView]);
  }
  window.scrollTo(0, 0);
  const statusCopy = {
    welcome: "Choose Login or Create an account to enter the Link-Up workspace.",
    login: "Login requires password and OTP verification.",
    register: "Create an account first. OTP verification is required before profile setup.",
    otp: "Enter the OTP before continuing.",
    profile: "Complete this required profile questionnaire before entering the workspace.",
  };
  $("#authStatus").textContent = statusCopy[nextView] || statusCopy.welcome;
}

function fillSelect(select, items) {
  if (!select || select.children.length) return;
  select.innerHTML = items.map((item) => `<option value="${escapeAttr(item)}">${item}</option>`).join("");
}

function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setFieldValue(field, value) {
  if (!field || !field.name) return;
  if (field.tagName === "SELECT" && field.multiple) {
    const selected = new Set(splitList(value));
    [...field.options].forEach((option) => {
      option.selected = selected.has(option.value) || selected.has(option.textContent);
    });
    updateMultiPicker(field);
    return;
  }
  field.value = value ?? "";
}

function formValues(form) {
  syncAllMultiPickers(form);
  const values = {};
  [...form.elements].forEach((field) => {
    if (!field.name || field.disabled || ["submit", "button"].includes(field.type)) return;
    if (field.tagName === "SELECT" && field.multiple) {
      values[field.name] = [...field.selectedOptions].map((option) => option.value).join(";");
    } else {
      values[field.name] = field.value;
    }
  });
  return values;
}

function enhanceProfileMultiSelects() {
  $$("#firstProfileForm select[multiple], #profileForm select[multiple]").forEach((select) => {
    if (select.dataset.enhanced === "true") {
      updateMultiPicker(select);
      return;
    }
    select.dataset.enhanced = "true";
    select.classList.add("native-multi-select");
    const picker = document.createElement("div");
    picker.className = "multi-picker";
    picker.dataset.forName = select.name;
    picker.innerHTML = `
      <button class="multi-picker-toggle" type="button" aria-expanded="false">
        <span class="multi-picker-summary">Select options</span>
        <span aria-hidden="true">v</span>
      </button>
      <div class="multi-picker-menu" hidden></div>
    `;
    select.insertAdjacentElement("afterend", picker);
    renderMultiPicker(select);
  });
}

function renderMultiPicker(select) {
  const picker = select.nextElementSibling?.classList.contains("multi-picker") ? select.nextElementSibling : null;
  if (!picker) return;
  const menu = picker.querySelector(".multi-picker-menu");
  menu.innerHTML = [...select.options].map((option, index) => `
    <label class="multi-picker-option">
      <input type="checkbox" value="${escapeAttr(option.value)}" data-option-index="${index}" ${option.selected ? "checked" : ""} />
      <span>${option.textContent}</span>
    </label>
  `).join("");
  updateMultiPicker(select);
}

function updateMultiPicker(select) {
  const picker = select.nextElementSibling?.classList.contains("multi-picker") ? select.nextElementSibling : null;
  if (!picker) return;
  const selected = [...select.selectedOptions].map((option) => option.value);
  picker.querySelector(".multi-picker-summary").innerHTML = selected.length
    ? selected.slice(0, 3).map((item) => `<span>${item}</span>`).join("") + (selected.length > 3 ? `<em>+${selected.length - 3}</em>` : "")
    : "Select options";
  picker.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    const option = select.options[Number(checkbox.dataset.optionIndex)];
    checkbox.checked = Boolean(option?.selected);
  });
}

function syncPickerToSelect(picker) {
  const select = picker.previousElementSibling?.matches("select[multiple]") ? picker.previousElementSibling : null;
  if (!select) return;
  picker.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    const option = select.options[Number(checkbox.dataset.optionIndex)];
    if (option) option.selected = checkbox.checked;
  });
  updateMultiPicker(select);
}

function syncAllMultiPickers(scope = document) {
  scope.querySelectorAll?.(".multi-picker").forEach(syncPickerToSelect);
}

function closeOtherMultiPickers(currentPicker = null) {
  $$(".multi-picker").forEach((picker) => {
    if (picker === currentPicker) return;
    picker.classList.remove("open");
    picker.querySelector(".multi-picker-menu").hidden = true;
    picker.querySelector(".multi-picker-toggle").setAttribute("aria-expanded", "false");
  });
}

function applyAuthenticatedSession(payload) {
  authToken = payload.token || authToken;
  if (authToken) localStorage.setItem("linkup_auth_token", authToken);
  currentProfile = payload.profile || currentProfile;
  $("#signedInName").textContent = currentProfile.name || "Link-Up User";
  $("#signedInEmail").textContent = currentProfile.email || payload.email || "";
}

function profileNeedsSetup(profile = currentProfile) {
  return !profile.institution || !profile.skills || !profile.availability || !profile.major;
}

function fillFirstProfileForm() {
  populateAuthOptions();
  const form = $("#firstProfileForm");
  [...form.elements].forEach((field) => {
    if (field.name && currentProfile[field.name] !== undefined) {
      setFieldValue(field, currentProfile[field.name] || "");
    }
  });
}

async function enterWorkspace() {
  if (!authToken) {
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    showAuthView("welcome");
    return;
  }

  document.body.classList.add("authenticated");
  document.body.classList.remove("auth-locked");

  if (!location.hash.startsWith("#/app")) {
    history.pushState(null, "", "#/app/home");
  }

  await loadData();
  startChatPolling();
  switchView("home");
}

async function checkSession() {
  populateAuthOptions();

  document.body.classList.remove("authenticated");
  document.body.classList.add("auth-locked");

  if (!authToken) {
    localStorage.removeItem("linkup_auth_token");
    showAuthView("welcome");
    return;
  }

  try {
    const response = await fetch("/api/session", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const payload = await response.json();

    if (!response.ok || !payload.authenticated) {
      authToken = "";
      localStorage.removeItem("linkup_auth_token");
      document.body.classList.remove("authenticated");
      document.body.classList.add("auth-locked");
      showAuthView("welcome");
      return;
    }

    applyAuthenticatedSession(payload);

    if (profileNeedsSetup(payload.profile)) {
      fillFirstProfileForm();
      document.body.classList.remove("authenticated");
      document.body.classList.add("auth-locked");
      showAuthView("profile");
      return;
    }

    await enterWorkspace();
  } catch (error) {
    console.error("Session check failed:", error);
    authToken = "";
    localStorage.removeItem("linkup_auth_token");
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    showAuthView("welcome");
  }
}

function syncAuthRouteFromHash() {
  if (document.body.classList.contains("authenticated")) return;
  const routes = {
    "#/welcome": "welcome",
    "#/login": "login",
    "#/register": "register",
    "#/verify-otp": pendingAuth ? "otp" : "welcome",
    "#/profile-setup": authToken ? "profile" : "welcome",
  };
  const view = routes[location.hash] || "welcome";
  showAuthView(view);
}

function splitList(value) {
  return String(value || "").split(";").map((item) => item.trim()).filter(Boolean);
}

function displayList(value) {
  return splitList(value).join(", ");
}

function chips(value) {
  return `<div class="chip-row">${splitList(value).slice(0, 6).map((item) => `<span>${item}</span>`).join("")}</div>`;
}

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stopSpeech() {
  const stoppedSource = activeSpeechSource;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  speechToken += 1;
  activeSpeechSource = "";
  $("#voiceAssistant")?.classList.remove("speaking");
  if (stoppedSource === "voiceAssistant") clearGuidedHighlight();
}

function speakText(text, options = {}) {
  if (!("speechSynthesis" in window)) {
    showToast("Audio narration is not supported in this browser.");
    return;
  }
  stopSpeech();
  if (options.respectIntroMute && introMuted) return;
  activeSpeechSource = options.source || "general";
  const token = ++speechToken;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  if (activeSpeechSource === "voiceAssistant") {
    $("#voiceAssistant")?.classList.add("speaking");
  }
  const clearIfCurrent = () => {
    if (token === speechToken) {
      activeSpeechSource = "";
      $("#voiceAssistant")?.classList.remove("speaking");
    }
  };
  utterance.onend = clearIfCurrent;
  utterance.onerror = clearIfCurrent;
  window.speechSynthesis.speak(utterance);
}

function renderIntroStep() {
  const step = introSteps[introIndex];
  $("#introStepBadge").textContent = `Step ${introIndex + 1} / ${introSteps.length}`;
  $("#introTitle").textContent = step.title;
  $("#introBody").textContent = step.body;
  $("#introCaption").textContent = step.narration;
  $("#introProgress").style.width = `${((introIndex + 1) / introSteps.length) * 100}%`;
  $("#introPlayPause").textContent = introPlaying ? "Pause narration" : "Play narration";
  $("#introMute").textContent = introMuted ? "Unmute" : "Mute";
}

function playIntroStep() {
  introPlaying = true;
  renderIntroStep();
  speakText(introSteps[introIndex].narration, { respectIntroMute: true, source: "intro" });
}

function pauseIntro() {
  introPlaying = false;
  stopSpeech();
  renderIntroStep();
}

function moveIntro(delta) {
  introIndex = (introIndex + delta + introSteps.length) % introSteps.length;
  renderIntroStep();
  if (introPlaying) playIntroStep();
}

function openIntroGuide() {
  introIndex = 0;
  introPlaying = false;
  renderIntroStep();
  $("#introDialog").showModal();
}

function setupIntroVideoFallback() {
  const video = $("#linkupIntroVideo");
  const fallback = $("#introVideoFallback");
  if (!video || !fallback) return;
  const showFallback = () => fallback.classList.add("show");
  const hideFallback = () => fallback.classList.remove("show");
  video.addEventListener("loadeddata", hideFallback);
  video.addEventListener("error", showFallback);
  const sourceUrl = video.dataset.videoSrc;
  if (!sourceUrl) {
    showFallback();
    return;
  }
  fetch(sourceUrl, { method: "HEAD" })
    .then((response) => {
      if (!response.ok) throw new Error("Intro video asset missing");
      const source = document.createElement("source");
      source.src = sourceUrl;
      source.type = "video/mp4";
      source.addEventListener("error", showFallback);
      video.appendChild(source);
      video.load();
    })
    .catch(showFallback);
}

function getActiveViewId() {
  return $(".view.active")?.id || "home";
}

function selectedChoiceLabels(name) {
  return $$(`[data-name="${name}"] input:checked`).map((input) => input.value);
}

function hasDraftMatchingChoices() {
  return ["preferred_roles", "skills", "interests", "goals"].some((name) => selectedChoiceLabels(name).length > 0)
    || Boolean($("#recruitRoleSelect")?.value);
}

function getVisibleMatchCards() {
  return $$("#matchResults .match-card").map((card) => ({
    name: card.querySelector("h3")?.textContent.trim() || "Unknown candidate",
    score: card.querySelector(".score span")?.textContent.trim() || "",
    meta: card.querySelector(".muted")?.textContent.trim() || "",
    reason: (card.querySelector(".explain")?.textContent || "").replace("Explainable AI reason:", "").trim(),
  }));
}

function clearGuidedHighlight() {
  $$(".guided-highlight").forEach((node) => node.classList.remove("guided-highlight"));
  $$(".guided-dim").forEach((node) => node.classList.remove("guided-dim"));
  $("#guideBubble")?.remove();
}

function showGuideBubble(target, message) {
  if (!target || !message) return;
  const bubble = document.createElement("div");
  bubble.id = "guideBubble";
  bubble.className = "guide-bubble";
  bubble.textContent = message;
  $(".main")?.appendChild(bubble);
  const targetRect = target.getBoundingClientRect();
  const mainRect = $(".main").getBoundingClientRect();
  const bubbleWidth = 270;
  const left = clamp(targetRect.left - mainRect.left + targetRect.width / 2 - bubbleWidth / 2, 18, mainRect.width - bubbleWidth - 18);
  const top = clamp(targetRect.top - mainRect.top - 62, 18, mainRect.height - 84);
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function guideTarget(selector, message, options = {}) {
  clearGuidedHighlight();
  const target = typeof selector === "string" ? $(selector) : selector;
  if (!target) return;
  if (options.dimView) {
    $$(".view.active .panel, .view.active .function-card, .view.active .home-intro-video, .view.active .hero").forEach((node) => {
      if (node !== target && !node.contains(target)) node.classList.add("guided-dim");
    });
  }
  target.classList.add("guided-highlight");
  showGuideBubble(target, message);
}

function applyVisualGuidance() {
  const view = getActiveViewId();
  if (view === "home") {
    guideTarget("#homeIntroVideo", "Start here: watch the intro or open the guided walkthrough.", { dimView: true });
    return;
  }
  if (view === "ai") {
    const cards = getVisibleMatchCards();
    if (cards.length) {
      guideTarget("#matchResults .match-card:first-child", "Review the top recommendation, then send a request if it fits.", { dimView: true });
      $$("#matchResults .match-card:first-child .score, #matchResults .match-card:first-child .explain, #matchResults .match-card:first-child [data-send-request]").forEach((node) => node.classList.add("guided-highlight"));
      return;
    }
    if (!appliedIntent && hasDraftMatchingChoices()) {
      guideTarget("#applyPreferences", "You changed preferences. Apply them before running AI Matching.", { dimView: true });
      return;
    }
    if (appliedIntent) {
      guideTarget("#runMatch", "Preferences are applied. Click here to generate recommendations.", { dimView: true });
      return;
    }
    if (currentMode === "recruit" && !(appData.my_teams || []).length) {
      guideTarget('[data-jump="teams"]', "Create a team first before recruiting teammates.", { dimView: true });
      return;
    }
    const firstChoice = currentMode === "team" ? '[data-name="preferred_roles"]' : '[data-name="preferred_roles"]';
    guideTarget(firstChoice, "Choose what kind of collaborator or team role you need first.", { dimView: true });
    return;
  }
  if (view === "search") {
    guideTarget("#searchInput", "Search by role, skill, interest, or team theme. Case does not matter.", { dimView: true });
    return;
  }
  if (view === "teams") {
    guideTarget("#teamForm", "Define your team size and roles, then publish the opportunity.", { dimView: true });
    return;
  }
  if (view === "competitions") {
    guideTarget("#competitionList", "Select a competition to inspect requirements, rewards, and existing teams.", { dimView: true });
    return;
  }
  if (view === "messages") {
    guideTarget("#conversationList", "Choose an unlocked collaboration or team chat from this list.", { dimView: true });
    return;
  }
  if (view === "lifecycle") {
    guideTarget("#timeline", "Track collaboration status from request to completion or outcome sharing.", { dimView: true });
    return;
  }
  if (view === "profile") {
    guideTarget("#profileForm", "Update your profile here. AI Matching uses this data automatically.", { dimView: true });
  }
}

function summarizeCandidatesForVoice(cards) {
  if (!cards.length) return "";
  const limited = cards.slice(0, 3).map((card, index) => {
    const place = index === 0 ? "First" : index === 1 ? "Second" : "Third";
    return `${place}, ${card.name}, ${card.score} compatibility, ${card.meta}. ${card.reason}`;
  }).join(" ");
  const best = cards[0];
  return `${limited} Based on the current ranking, I recommend starting with ${best.name}, because this candidate has the highest compatibility score and the strongest fit for your current preferences.`;
}

function buildAiMatchingVoiceSummary() {
  const cards = getVisibleMatchCards();
  const modeLabel = currentMode === "individual"
    ? "Find Individual Collaborator"
    : currentMode === "team"
      ? "Find a Team to Join"
      : "Recruit Teammates for My Team";
  if (cards.length) {
    return `You are on AI Matching, ${modeLabel} mode. Matching results are already generated. ${summarizeCandidatesForVoice(cards)} If you agree, send a collaboration request to the best candidate.`;
  }

  if (!appliedIntent && hasDraftMatchingChoices()) {
    return `You are on AI Matching, ${modeLabel} mode. You have selected some preferences, but they have not been confirmed yet. Click Apply Matching Preferences first, then run AI Matching so the system uses your latest choices.`;
  }

  if (appliedIntent) {
    return `You are on AI Matching, ${modeLabel} mode. Your preferences are applied. The next step is to click Run AI Matching and wait for the explainable recommendation results.`;
  }

  if (currentMode === "individual") {
    return "You are on AI Matching, Find Individual Collaborator mode. Choose the project type, the teammate role you want, must-have skills, and preferred project direction. After selecting them, click Apply Matching Preferences.";
  }
  if (currentMode === "team") {
    return "You are on AI Matching, Find a Team to Join mode. Choose the team theme, the role you want to take, the team stage, and team goals. Then apply preferences and run matching to see recommended teams.";
  }
  if (currentMode === "recruit") {
    if (!(appData.my_teams || []).length) {
      return "You are on AI Matching, Recruit Teammates for My Team mode. You need to create a team first before recruiting teammates. Go to Team Creation, publish your team, then return here.";
    }
    return "You are on AI Matching, Recruit Teammates for My Team mode. Select your saved team, choose one open role to recruit now, review the required skills for that role, then apply preferences and run AI Matching.";
  }
  return "You are on AI Matching. Choose a matching mode and follow the preference steps.";
}

function buildVoiceAssistantSummary() {
  const view = getActiveViewId();
  if (view === "ai") return buildAiMatchingVoiceSummary();
  if (view === "home") {
    return "You are on the Link-Up home page. You can start AI Matching, watch the intro guide, create a team, or open one of the four main functions. For the coded demo, start with AI Matching.";
  }
  if (view === "search") {
    const count = $$("#searchResults article").length;
    return `You are on Manual Search. Use the search box and filters to find individuals or teams manually. There are currently ${count} visible results. Click View Profile to inspect a collaborator before sending a request.`;
  }
  if (view === "teams") {
    return "You are on Team Creation. Define your team name, project idea, project type, team size, and roles needed. After publishing, the team is saved and Recruit Teammates mode becomes available.";
  }
  if (view === "competitions") {
    return "You are on Competitions. Select a challenge to review its introduction, requirements, rewards, and existing teams. You can apply to join a team or create a team for the competition.";
  }
  if (view === "messages") {
    return "You are on Messages. Link-Up keeps communication focused. Chats unlock after collaboration is accepted or after a team is created.";
  }
  if (view === "lifecycle") {
    return "You are on Collaboration Lifecycle. This page tracks request sent, waiting response, active collaboration, completion request, and outcome showcase.";
  }
  if (view === "profile") {
    return "You are on your Link-Up profile. Profile data is synced with AI Matching, so updating skills, interests, and portfolio improves future recommendations.";
  }
  return "This is Link-Up. Use the navigation to move between matching, search, teams, competitions, messages, lifecycle, and profile.";
}

function runVoiceAssistant() {
  if (suppressNextAssistantClick) {
    suppressNextAssistantClick = false;
    return;
  }
  if (activeSpeechSource === "voiceAssistant" && "speechSynthesis" in window && window.speechSynthesis.speaking) {
    stopSpeech();
    return;
  }
  applyVisualGuidance();
  speakText(buildVoiceAssistantSummary(), { source: "voiceAssistant" });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setAssistantPosition(left, top) {
  const button = $("#voiceAssistant");
  const main = $(".main");
  if (!button || !main) return;
  const maxLeft = Math.max(12, main.clientWidth - button.offsetWidth - 12);
  const maxTop = Math.max(12, main.clientHeight - button.offsetHeight - 12);
  const nextLeft = clamp(left, 12, maxLeft);
  const nextTop = clamp(top, 12, maxTop);
  button.style.left = `${nextLeft}px`;
  button.style.top = `${nextTop}px`;
  try {
    localStorage.setItem("linkupVoiceAssistantPosition", JSON.stringify({ left: nextLeft, top: nextTop }));
  } catch (_) {}
}

function restoreAssistantPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem("linkupVoiceAssistantPosition") || "null");
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      setAssistantPosition(saved.left, saved.top);
    }
  } catch (_) {}
}

function startAssistantDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const button = $("#voiceAssistant");
  if (!button) return;
  assistantDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: button.offsetLeft,
    startTop: button.offsetTop,
    moved: false,
  };
  button.setPointerCapture?.(event.pointerId);
  button.classList.add("dragging");
}

function moveAssistantDrag(event) {
  if (!assistantDragState || assistantDragState.pointerId !== event.pointerId) return;
  const dx = event.clientX - assistantDragState.startX;
  const dy = event.clientY - assistantDragState.startY;
  if (Math.abs(dx) + Math.abs(dy) > 4) assistantDragState.moved = true;
  setAssistantPosition(assistantDragState.startLeft + dx, assistantDragState.startTop + dy);
}

function endAssistantDrag(event) {
  if (!assistantDragState || assistantDragState.pointerId !== event.pointerId) return;
  const button = $("#voiceAssistant");
  if (assistantDragState.moved) {
    suppressNextAssistantClick = true;
  }
  button?.releasePointerCapture?.(event.pointerId);
  button?.classList.remove("dragging");
  assistantDragState = null;
}

function bindHoverTilt() {
  const selectors = ".function-card, .match-card, .person-card, .team-card, .competition-card";
  document.querySelectorAll(selectors).forEach((card) => {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = "true";
    card.addEventListener("pointermove", (event) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--tilt-x", `${(-y * 2.2).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(x * 2.2).toFixed(2)}deg`);
      card.style.setProperty("--lift-y", "-8px");
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
      card.style.removeProperty("--lift-y");
    });
  });
}

function collectChoice(name) {
  return $$(`[data-name="${name}"] input:checked`).map((input) => input.value).join(";");
}

function collectTeamRoleCounts() {
  return $$('[data-name="team_roles"] .role-count-row')
    .filter((row) => row.querySelector('input[type="checkbox"]')?.checked)
    .map((row) => {
      const role = row.querySelector('input[type="checkbox"]').value;
      const quantity = Math.min(10, Math.max(1, Number(row.querySelector(".role-count")?.value || 1)));
      return `${role}:${quantity}`;
    })
    .join(";");
}

function teamRoleCountTotal(roleCounts = collectTeamRoleCounts()) {
  return splitList(roleCounts).reduce((sum, item) => {
    const count = Number(item.split(":")[1] || 1);
    return sum + (Number.isFinite(count) ? count : 1);
  }, 0);
}

function displayRoleCounts(roleCounts, fallbackRoles = "") {
  const counts = splitList(roleCounts);
  if (counts.length) {
    return counts.map((item) => {
      const [role, count] = item.split(":");
      return `${role.trim()} x${Number(count || 1)}`;
    }).join("; ");
  }
  return splitList(fallbackRoles).map((role) => `${role} x1`).join("; ");
}

function parseRoleCounts(roleCounts = "", fallbackRoles = "") {
  const result = {};
  splitList(roleCounts).forEach((item) => {
    const [role, count] = item.split(":");
    if (role) result[role.trim()] = Math.min(10, Math.max(1, Number(count || 1)));
  });
  if (!Object.keys(result).length) {
    splitList(fallbackRoles).forEach((role) => {
      result[role] = 1;
    });
  }
  return result;
}

function setTeamRoleChoices(roleCounts = "", fallbackRoles = "") {
  const counts = parseRoleCounts(roleCounts, fallbackRoles);
  $$('[data-name="team_roles"] .role-count-row').forEach((row) => {
    const checkbox = row.querySelector('input[type="checkbox"]');
    const countInput = row.querySelector(".role-count");
    const quantity = counts[checkbox.value];
    checkbox.checked = Boolean(quantity);
    if (countInput) countInput.value = quantity || 1;
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bml\b/g, "machine learning")
    .replace(/\bui\s*ux\b/g, "ui/ux")
    .replace(/\bux\b/g, "ui/ux")
    .replace(/\bdevops\b/g, "devops dev ops")
    .replace(/\bvr\b/g, "virtual reality ar/vr")
    .replace(/\bai\b/g, "artificial intelligence ai")
    .replace(/[^a-z0-9/+.#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchableText(item) {
  const text = item.team_name
    ? [item.team_name, item.idea, item.project_type, item.open_roles, item.role_counts, item.status, item.institution, item.owner_email].join(" ")
    : [item.name, item.email, item.role, item.experience, item.skills, item.interests, item.project_types, item.goals, item.portfolio, item.badges, item.institution, item.organisation_type, item.company, item.location, item.major].join(" ");
  const role = item.role || item.open_roles || "";
  const roleExpansion = splitList(role).map((entry) => {
    if (entry === "ML Engineer") return "Machine Learning Engineer";
    if (entry === "UI/UX Designer") return "UI UX UX Designer User Interface User Experience";
    if (entry === "AR/VR Developer") return "Virtual Reality Augmented Reality Developer";
    return entry;
  }).join(" ");
  return normalizeSearchText(`${text} ${roleExpansion}`);
}

function skillsForRole(role) {
  const recommended = roleSkillMap[role] || [];
  return [...new Set([...recommended, ...skills])];
}

function switchView(id) {
  stopSpeech();
  clearGuidedHighlight();
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === id));
}

function getMatchPayload() {
  if (!appliedIntent) return null;
  const selectedTeam = (appData.my_teams || []).find((team) => team.id === selectedTeamId);
  return {
    ...currentProfile,
    mode: currentMode,
    team_id: selectedTeamId,
    ...appliedIntent,
    target_project_type: selectedTeam ? selectedTeam.project_type : appliedIntent.target_project_type,
    target_skills: appliedIntent.target_skills,
    target_roles: selectedTeam ? (appliedIntent.target_roles || selectedTeam.open_roles) : appliedIntent.target_roles,
    target_goals: appliedIntent.target_goals || "",
    target_stage: appliedIntent.target_stage || "",
  };
}

function readCurrentIntent() {
  const form = $("#matchForm");
  const values = Object.fromEntries(new FormData(form).entries());
  const recruitRole = values.recruit_role || "";
  return {
    search_priority: values.priority,
    target_project_type: values.project_type,
    target_roles: currentMode === "recruit" && recruitRole ? recruitRole : collectChoice("preferred_roles"),
    target_skills: collectChoice("skills"),
    target_interests: collectChoice("interests"),
    target_goals: collectChoice("goals"),
    target_stage: values.stage || "",
  };
}

function applyPreferences() {
  const intent = readCurrentIntent();
  if (currentMode !== "team" && !intent.target_roles) {
    $("#appliedPreferenceStatus").textContent = currentMode === "recruit"
      ? "Please select at least one open role from your team before applying."
      : "Please select at least one preferred teammate role before applying.";
    $("#runMatch").disabled = true;
    return;
  }
  if (currentMode !== "team" && !intent.target_skills) {
    $("#appliedPreferenceStatus").textContent = "Please select at least one must-have teammate skill before applying.";
    $("#runMatch").disabled = true;
    return;
  }
  if (currentMode === "team" && !intent.target_roles) {
    $("#appliedPreferenceStatus").textContent = "Please select the role you want to join as.";
    $("#runMatch").disabled = true;
    return;
  }
  if (currentMode === "team" && !intent.target_interests && !intent.target_goals) {
    $("#appliedPreferenceStatus").textContent = "Please select at least one target team goal or direction.";
    $("#runMatch").disabled = true;
    return;
  }
  if (currentMode === "recruit" && !(appData.my_teams || []).length) {
    $("#appliedPreferenceStatus").textContent = "Create a team first. Recruit mode uses the roles from your saved team.";
    $("#runMatch").disabled = true;
    return;
  }
  appliedIntent = intent;
  $("#runMatch").disabled = false;
  $("#appliedPreferenceStatus").innerHTML = `
    Applied: <strong>${displayList(intent.target_roles || "Team search")}</strong>
    - skills: <strong>${displayList(intent.target_skills || "Profile skills")}</strong>
    - project: <strong>${intent.target_project_type}</strong>
  `;
  renderEmptyMatches();
}

function markPreferencesDirty() {
  appliedIntent = null;
  $("#runMatch").disabled = true;
  $("#appliedPreferenceStatus").textContent = "Preferences changed. Click Apply Matching Preferences before running AI Matching.";
  renderEmptyMatches();
}

async function loadData() {
  const response = await apiFetch("/api/data");
  if (!response.ok) return;
  appData = await response.json();
  currentProfile = appData.profile || currentProfile;
  $("#signedInName").textContent = currentProfile.name || "Link-Up User";
  $("#signedInEmail").textContent = currentProfile.email || "";
  fillProfileForm();
  requestState = appData.requests || [];
  if ((appData.my_teams || []).length && !selectedTeamId) selectedTeamId = appData.my_teams[0].id;
  const status = appData.ai_provider === "gemini"
    ? `Gemini connected (${appData.gemini_model})`
    : "Fallback AI active";
  $("#aiStatus small").textContent = status;
  renderSearchFilters();
  renderSearch();
  renderTeams();
  renderCompetitions();
  renderMessages();
  renderLifecycle();
  renderProfile();
  renderProfileContext();
  renderRecruitPanel();
  renderMatchingForm();
  renderEmptyMatches();
  bindHoverTilt();
}

async function refreshAiStatus() {
  const response = await fetch("/api/settings");
  const settings = await response.json();
  $("#aiStatus small").textContent = settings.gemini_configured
    ? `Gemini connected (${settings.key_source})`
    : "Fallback AI active";
}

function fillProfileForm() {
  const form = $("#profileForm");
  if (!form) return;
  populateAuthOptions();
  [...form.elements].forEach((field) => {
    if (field.name && currentProfile[field.name] !== undefined) {
      setFieldValue(field, currentProfile[field.name]);
    }
  });
}

function renderEmptyMatches() {
  $("#modelBadge").textContent = "Ready";
  $("#matchResults").innerHTML = `<div class="empty"><div><h3>No match generated yet</h3><p>Choose a mode, apply the latest preferences, then run AI Matching.</p></div></div>`;
}

function filterOptionList(items, selected = "") {
  return `<option value="">Any</option>${items.map((item) => `<option value="${item}" ${item === selected ? "selected" : ""}>${item}</option>`).join("")}`;
}

function optionList(items, selected = "") {
  return items.map((item) => `<option ${item === selected ? "selected" : ""}>${item}</option>`).join("");
}

function choiceSet(name, legend, items, checkedItems = []) {
  const selected = new Set(checkedItems);
  return `
    <fieldset class="choice-set" data-name="${name}">
      <legend>${legend}</legend>
      ${items.map((item) => `<label><input type="checkbox" value="${item}" ${selected.has(item) ? "checked" : ""} />${item}</label>`).join("")}
    </fieldset>
  `;
}

function applyBox(copy) {
  return `
    <div class="apply-box">
      <button class="primary" id="applyPreferences" type="button">Apply Matching Preferences</button>
      <p class="muted" id="appliedPreferenceStatus">${copy}</p>
    </div>
    <div class="profile-context" id="profileContext"></div>
  `;
}

function renderMatchingForm() {
  const form = $("#matchForm");
  const selectedTeam = (appData.my_teams || []).find((team) => team.id === selectedTeamId);
  let html = "";

  if (currentMode === "individual") {
    html = `
      <div class="mode-note">
        <strong>Individual collaborator search</strong>
        <p class="muted">This mode asks who you want as a teammate. Your own role, availability and interests come from Profile automatically.</p>
      </div>
      <div class="form-grid">
        <label>Project type / collaboration context
          <select name="project_type">${optionList(projectTypes, "AI Product")}</select>
        </label>
        <label>Matching priority
          <select name="priority">
            <option value="role_first">Role fit first</option>
            <option value="skill_first">Skill coverage first</option>
            <option value="availability_first">Availability first</option>
            <option value="organisation_first">Same university / company first</option>
            <option value="balanced">Balanced recommendation</option>
          </select>
        </label>
      </div>
      ${choiceSet("preferred_roles", "Preferred teammate roles", roles)}
      ${choiceSet("skills", "Must-have teammate skills", skills)}
      ${choiceSet("interests", "Interests / project direction", directions)}
      ${applyBox("No individual matching preferences confirmed yet.")}
    `;
  } else if (currentMode === "team") {
    html = `
      <div class="mode-note">
        <strong>Team joining search</strong>
        <p class="muted">This mode searches teams, so the questions focus on the target team theme, open role, stage and team goals.</p>
      </div>
      <div class="form-grid">
        <label>Target team project type
          <select name="project_type">${optionList(projectTypes, "Competition")}</select>
        </label>
        <label>Preferred team stage
          <select name="stage">${optionList(teamStages, "Prototype building")}</select>
        </label>
        <label>Matching priority
          <select name="priority">
            <option value="role_first">Open role fit first</option>
            <option value="project_first">Team theme first</option>
            <option value="goal_first">Team goal first</option>
            <option value="organisation_first">Same university / company first</option>
            <option value="balanced">Balanced team fit</option>
          </select>
        </label>
      </div>
      ${choiceSet("preferred_roles", "Role you want to take in a team", roles)}
      ${choiceSet("goals", "Target team goals", teamStages)}
      ${choiceSet("interests", "Interests / project direction", directions)}
      ${applyBox("No team-joining preferences confirmed yet.")}
    `;
  } else if (!selectedTeam) {
    html = `
      <div class="mode-note warning">
        <strong>Create a team first</strong>
        <p class="muted">Recruit mode is only available after you publish a team. This prevents users from recruiting without a real team context.</p>
        <button class="primary" type="button" data-jump="teams">Create Team</button>
      </div>
    `;
  } else {
    const openRoles = splitList(selectedTeam.open_roles);
    if (!openRoles.includes(currentRecruitRole)) currentRecruitRole = openRoles[0] || roles[0];
    const recommendedSkills = roleSkillMap[currentRecruitRole] || [];
    html = `
      <div class="mode-note">
        <strong>Recruit for ${selectedTeam.team_name}</strong>
        <p class="muted">Recruit one open role at a time, so each role has its own skill standard. Switch role and run matching again when you want to recruit another position.</p>
      </div>
      <div class="form-grid">
        <label>Team project type / collaboration context
          <select name="project_type">${optionList(projectTypes, selectedTeam.project_type)}</select>
        </label>
        <label>Open role to recruit now
          <select name="recruit_role" id="recruitRoleSelect">${optionList(openRoles.length ? openRoles : roles, currentRecruitRole)}</select>
        </label>
        <label>Recruitment priority
          <select name="priority">
            <option value="role_first">Open role fit first</option>
            <option value="skill_first">Applicant skill first</option>
            <option value="availability_first">Availability first</option>
            <option value="organisation_first">Same university / company first</option>
            <option value="balanced">Balanced recommendation</option>
          </select>
        </label>
      </div>
      ${choiceSet("skills", `Required skills for ${currentRecruitRole}`, skillsForRole(currentRecruitRole), recommendedSkills)}
      ${choiceSet("interests", "Applicant interests / project direction", directions)}
      ${applyBox("No recruitment preferences confirmed yet.")}
    `;
  }

  form.innerHTML = html;
  form.onchange = markPreferencesDirty;
  appliedIntent = null;
  $("#runMatch").disabled = true;
  const recruitRoleSelect = $("#recruitRoleSelect");
  if (recruitRoleSelect) {
    recruitRoleSelect.addEventListener("change", (event) => {
      currentRecruitRole = event.target.value;
      renderMatchingForm();
      renderEmptyMatches();
    });
  }
  renderProfileContext();
}

async function runMatching() {
  if (!appliedIntent) {
    $("#modelBadge").textContent = "Apply first";
    $("#matchResults").innerHTML = `<div class="empty"><div><h3>Confirm your preferences first</h3><p>Click Apply Matching Preferences so the system uses the latest role and skill choices.</p></div></div>`;
    return;
  }
  if (currentMode === "recruit" && !(appData.my_teams || []).length) {
    $("#matchResults").innerHTML = `<div class="empty"><div><h3>Create a team first</h3><p>You can recruit teammates only after creating your own team.</p><button class="primary" data-jump="teams">Create Team</button></div></div>`;
    $("#modelBadge").textContent = "Team required";
    return;
  }
  if (currentMode === "recruit" && !selectedTeamId) {
    $("#matchResults").innerHTML = `<div class="empty"><div><h3>Select a team first</h3><p>Choose which team you want to recruit for.</p></div></div>`;
    $("#modelBadge").textContent = "Select team";
    return;
  }
  $("#modelBadge").textContent = "Thinking...";
  $("#matchResults").innerHTML = `<div class="empty"><div><h3>AI is analyzing candidates...</h3><p>Checking skills, interests, role fit, availability and collaboration style.</p></div></div>`;
  const response = await apiFetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getMatchPayload()),
  });
  const payload = await response.json();
  if (!response.ok) {
    $("#modelBadge").textContent = "Action required";
    $("#matchResults").innerHTML = `<div class="empty"><div><h3>${payload.error || "Unable to match"}</h3><p>This mode needs a valid team context.</p><button class="primary" data-jump="teams">Create Team</button></div></div>`;
    return;
  }
  $("#modelBadge").textContent = payload.provider === "gemini" ? `Gemini API: ${payload.model}` : "Fallback AI";
  $("#matchResults").innerHTML = payload.matches.map(renderMatchCard).join("");
  if (payload.provider !== "gemini" && payload.gemini_error) {
    $("#matchResults").insertAdjacentHTML("afterbegin", `<p class="explain"><strong>Gemini fallback:</strong> Gemini was slow or unavailable, so fallback results are shown. (${payload.gemini_error})</p>`);
  }
  bindHoverTilt();
}

function renderMatchCard(match) {
  const title = match.team_name || match.name;
  const role = match.role || `${match.open_roles} needed`;
  const profileTarget = match.email || match.name || "";
  const profileButton = match.team_name ? "" : `<button class="secondary" type="button" data-profile-email="${escapeAttr(profileTarget)}">Check profile</button>`;
  return `
    <article class="match-card">
      <div class="match-top">
        <div class="score" style="--score:${match.score}%"><span>${match.score}%</span></div>
        <div>
          <h3>${title}</h3>
          <p class="muted">${role} - ${displayList(match.availability || match.project_type || "Active recruitment")}</p>
          ${chips(match.skills || match.open_roles || match.interests)}
        </div>
        <div class="match-actions">
          ${profileButton}
          <button class="secondary" data-send-request="${escapeAttr(title)}" data-role="${escapeAttr(role)}" data-target-email="${escapeAttr(match.email || "")}">Send request</button>
        </div>
      </div>
      <p class="explain"><strong>Explainable AI reason:</strong> ${match.explanation}</p>
      <button class="secondary audio-action" type="button" data-read-explanation="${escapeAttr(`${title}. ${match.explanation}`)}">Read AI Explanation</button>
    </article>
  `;
}

async function sendRequest(name, role, targetEmail = "", requestType = "") {
  const team = (appData.my_teams || []).find((item) => item.id === selectedTeamId);
  const type = requestType || (team ? "Team Invitation / Recruitment Request" : "Collaboration Request");
  const response = await apiFetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_name: name,
      target_email: targetEmail,
      target_role: role,
      request_type: type,
      project: currentMode === "recruit" && team ? team.idea : "AI Product Collaboration",
      team_name: team ? team.team_name : "",
    }),
  });
  const payload = await response.json();
  requestState = payload.requests || requestState;
  renderMessages(null);
  renderLifecycle();
  const button = document.querySelector(`[data-send-request="${CSS.escape(name)}"]`);
  if (button) {
    button.textContent = "Request sent";
    button.disabled = true;
  }
  showToast(`Request sent to ${name}. Status is now In Progress and saved.`);
}

function renderSearchFilters() {
  const roleLabel = searchType === "teams" ? "Open role" : "Role";
  const projectLabel = searchType === "teams" ? "Team project type" : "Project type / direction";
  $("#manualFilters").innerHTML = `
    <div class="filter-grid">
      <label>${roleLabel}
        <select data-manual-filter="role">${filterOptionList(roles, manualFilters.role)}</select>
      </label>
      <label>Skill
        <select data-manual-filter="skill">${filterOptionList(skills, manualFilters.skill)}</select>
      </label>
      <label>${projectLabel}
        <select data-manual-filter="project">${filterOptionList(projectTypes, manualFilters.project)}</select>
      </label>
      <label>School / organisation
        <select data-manual-filter="institution">${filterOptionList(malaysiaInstitutions, manualFilters.institution)}</select>
      </label>
      <button class="secondary" type="button" id="clearManualFilters">Clear filters</button>
    </div>
  `;
}

function renderSearch() {
  const query = normalizeSearchText($("#searchInput")?.value || "");
  const source = searchType === "teams" ? appData.teams : appData.users;
  const filtered = source.filter((item) => {
    const text = searchableText(item);
    const queryPass = !query || text.includes(query);
    const rolePass = !manualFilters.role || text.includes(normalizeSearchText(manualFilters.role));
    const skillPass = !manualFilters.skill || text.includes(normalizeSearchText(manualFilters.skill));
    const projectPass = !manualFilters.project || text.includes(normalizeSearchText(manualFilters.project));
    const institutionPass = !manualFilters.institution || text.includes(normalizeSearchText(manualFilters.institution));
    return queryPass && rolePass && skillPass && projectPass && institutionPass;
  }).slice(0, 18);
  $("#searchResults").innerHTML = filtered.map((item) => {
    if (searchType === "teams") {
      return `<article class="team-card"><h3>${item.team_name}</h3><p>${item.idea}</p><p class="muted">${displayRoleCounts(item.role_counts, item.open_roles)}</p>${chips(item.open_roles)}<button class="secondary" data-send-request="${escapeAttr(item.team_name)}" data-role="${escapeAttr(item.open_roles || "Team Member")}" data-target-email="${escapeAttr(item.owner_email || "")}" data-request-type="Team Join Request">Apply to Join</button></article>`;
    }
    const action = searchType === "invite" ? "Invite to Team" : "View Profile";
    const actionAttr = searchType === "invite" ? `data-send-request="${item.name}" data-role="${item.role}" data-target-email="${item.email}"` : `data-profile-email="${item.email}"`;
    return `<article class="person-card"><h3>${item.name}</h3><p>${item.role} - ${item.experience}</p><p class="muted">${item.institution || "Institution not provided"}</p>${chips(item.skills)}<button class="secondary" ${actionAttr}>${action}</button></article>`;
  }).join("") || `<div class="empty"><div><h3>No result found</h3><p>Try another role, skill, project direction, or abbreviation such as ML / UI UX.</p></div></div>`;
  bindHoverTilt();
}

function openManualProfile(identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();
  const person = appData.users.find((user) =>
    user.email?.toLowerCase() === normalized || user.name?.toLowerCase() === normalized
  );
  if (!person) return;
  $("#profileDialogBody").innerHTML = `
    <div class="profile-dialog-head">
      <div class="avatar">${person.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
      <div>
        <h3>${person.name}</h3>
        <p class="muted">${person.role} - ${person.experience}</p>
      </div>
    </div>
    <section>
      <h3>Institution</h3>
      <p>${person.institution || "Institution not provided"}${person.company ? ` - ${person.company}` : ""}</p>
      <p class="muted">${person.organisation_type || "Collaborator"} - ${person.major || "Field not provided"}</p>
    </section>
    <section>
      <h3>Self introduction</h3>
      <p>${person.bio || "This user has not added a self introduction yet."}</p>
    </section>
    <section>
      <h3>Skills</h3>
      ${chips(person.skills)}
    </section>
    <section>
      <h3>Interests</h3>
      ${chips(person.interests)}
    </section>
    <section>
      <h3>Portfolio</h3>
      <p>${displayList(person.portfolio || "Portfolio not added yet.")}</p>
    </section>
    <section>
      <h3>Availability and Style</h3>
      <p>${displayList(person.availability)} - ${displayList(person.communication_style)}</p>
    </section>
    <section>
      <h3>Badges</h3>
      ${chips(person.badges)}
    </section>
    <section>
      <h3>Trust signals</h3>
      <p>${person.verification_status || "Profile verified"} - Reliability score ${person.reliability_score || "80"}/100</p>
    </section>
    <div class="dialog-actions">
      <button class="secondary" type="button" id="closeProfileDialog">Close</button>
      <button class="primary" type="button" data-send-request="${person.name}" data-role="${person.role}" data-target-email="${person.email}">Send Collaboration Request</button>
    </div>
  `;
  $("#profileDialog").showModal();
  $("#closeProfileDialog").addEventListener("click", () => $("#profileDialog").close(), { once: true });
}

function renderTeams() {
  const form = $("#teamForm");
  const values = form ? Object.fromEntries(new FormData(form).entries()) : {};
  const roles = collectChoice("team_roles") || "ML Engineer;Backend Engineer;UI/UX Designer";
  const roleCounts = collectTeamRoleCounts();
  const teamSize = Math.min(10, Math.max(2, Number(values.size || 5)));
  const totalOpenSeats = teamRoleCountTotal(roleCounts);
  const capacityWarning = totalOpenSeats > teamSize
    ? `<p class="explain warning"><strong>Check team size:</strong> Open role quantity (${totalOpenSeats}) is higher than team size (${teamSize}). Increase team size or reduce role quantity before publishing.</p>`
    : "";
  const owned = (appData.my_teams || []).map((team) => `
    <article class="team-owned-card">
      <div>
        <strong>${escapeHtml(team.team_name)}</strong>
        <p>${escapeHtml(team.idea)}</p>
        <p class="muted">${escapeHtml(team.project_type || "Project")} · ${team.team_size || "5"} members max · ${escapeHtml(team.status || "Recruiting")}</p>
        <p class="muted">Open seats: ${escapeHtml(displayRoleCounts(team.role_counts, team.open_roles))}</p>
        ${chips(team.open_roles)}
      </div>
      <div class="team-card-actions">
        <button class="secondary" type="button" data-edit-team="${escapeAttr(team.id)}">Edit Team</button>
        <button class="primary" type="button" data-recruit-team="${escapeAttr(team.id)}">Recruit</button>
      </div>
    </article>
  `).join("");
  $("#teamPreview").innerHTML = `
    <div class="team-workspace">
      <section class="team-summary-card">
        <p class="eyebrow">${values.id ? "Editing saved team" : "Live recruitment preview"}</p>
        <h3>${escapeHtml(values.team_name || "New Team")}</h3>
        <p>${escapeHtml(values.idea || "Describe your project idea.")}</p>
        <div class="team-metrics">
          <span>${teamSize} members max</span>
          <span>${totalOpenSeats} open seats</span>
          <span>${escapeHtml(values.project_type || "AI Product")}</span>
        </div>
        <p class="muted">Open seats: ${escapeHtml(displayRoleCounts(roleCounts, roles))}</p>
        ${chips(roles)}
        ${capacityWarning}
      </section>
      <section>
        <div class="section-title-row">
          <h3>My Created Teams</h3>
          <span class="status-pill">${(appData.my_teams || []).length} saved</span>
        </div>
        <div class="created-team-list">
          ${owned || '<p class="muted">No saved team yet. Publish one to unlock teammate recruitment mode and competition participation.</p>'}
        </div>
      </section>
    </div>
  `;
}

function editTeam(teamId) {
  const team = (appData.my_teams || []).find((item) => item.id === teamId);
  if (!team) return;
  const form = $("#teamForm");
  setFieldValue(form.elements.id, team.id);
  setFieldValue(form.elements.team_name, team.team_name);
  setFieldValue(form.elements.idea, team.idea);
  setFieldValue(form.elements.project_type, team.project_type);
  setFieldValue(form.elements.size, team.team_size || "5");
  setTeamRoleChoices(team.role_counts, team.open_roles);
  $("#saveTeamButton").textContent = "Save Team Changes";
  $("#cancelTeamEdit").hidden = false;
  renderTeams();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetTeamForm() {
  const form = $("#teamForm");
  form.reset();
  setFieldValue(form.elements.id, "");
  setTeamRoleChoices("Machine Learning Engineer:1;Backend Engineer:2;UI/UX Designer:1", "");
  $("#saveTeamButton").textContent = "Publish Team Opportunity";
  $("#cancelTeamEdit").hidden = true;
  renderTeams();
}

function recruitForTeam(teamId) {
  selectedTeamId = teamId;
  currentMode = "recruit";
  $$("#matchMode .mode").forEach((button) => button.classList.toggle("active", button.dataset.mode === "recruit"));
  switchView("ai");
  renderRecruitPanel();
  renderMatchingForm();
  showToast("Recruit mode opened for your selected team.");
}

function renderRecruitPanel() {
  const panel = $("#recruitPanel");
  if (currentMode !== "recruit") {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const teams = appData.my_teams || [];
  if (!teams.length) {
    panel.innerHTML = `<strong>Team required</strong><p class="muted">You need to create a team before recruiting teammates.</p><button class="primary" data-jump="teams">Create Team</button>`;
    return;
  }
  panel.innerHTML = `
    <label>Select team for recruitment
      <select id="teamRecruitSelect">
        ${teams.map((team) => `<option value="${team.id}" ${team.id === selectedTeamId ? "selected" : ""}>${team.team_name} - ${displayList(team.open_roles)}</option>`).join("")}
      </select>
    </label>
  `;
  $("#teamRecruitSelect").addEventListener("change", (event) => {
    selectedTeamId = event.target.value;
    renderMatchingForm();
    renderEmptyMatches();
  });
}

function renderCompetitions(index = 0) {
  activeCompetitionIndex = index;
  $("#competitionList").innerHTML = appData.competitions.map((item, i) => `
    <article class="competition-card" data-competition="${i}">
      <h3>${item.title}</h3>
      <p>${item.theme}</p>
      <span class="tag">${item.reward}</span>
    </article>
  `).join("");
  const item = appData.competitions[index] || appData.competitions[0];
  const teams = appData.my_teams || [];
  const entry = (appData.competition_entries || []).find((saved) => saved.competition_title === item.title);
  $("#competitionDetail").innerHTML = `
    <div class="competition-detail-head">
      <span class="status-pill">${entry ? `Submitted: ${entry.team_name}` : "Open"}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.introduction)}</p>
    </div>
    <div class="detail-block">
      <h3>Requirements</h3>
      <p>${escapeHtml(item.requirements)}</p>
    </div>
    <div class="detail-block">
      <h3>Reward</h3>
      <p>${escapeHtml(item.reward)}</p>
    </div>
    <div class="detail-block">
      <h3>Existing teams</h3>
      ${(item.teams || []).map((team) => `<div class="competition-team-row"><div class="competition-team-info"><strong>${escapeHtml(team)}</strong><span>Recruiting members now</span></div><button class="secondary" data-send-request="${escapeAttr(team)}" data-role="Team Member" data-request-type="Team Join Request">Apply to Join</button></div>`).join("")}
    </div>
    <div class="competition-join-box">
      <h3>Join with my team</h3>
      ${teams.length ? `
        <label>Select one of your created teams
          <select id="competitionTeamSelect">
            ${teams.map((team) => `<option value="${escapeAttr(team.id)}" ${entry?.team_id === team.id ? "selected" : ""}>${escapeHtml(team.team_name)} - ${escapeHtml(displayRoleCounts(team.role_counts, team.open_roles))}</option>`).join("")}
          </select>
        </label>
        <button class="primary" type="button" data-join-competition="${escapeAttr(item.title)}">${entry ? "Update Competition Team" : "Submit Team Entry"}</button>
        ${entry ? `<p class="explain"><strong>Submitted:</strong> ${escapeHtml(entry.team_name)} joined this competition on ${escapeHtml(entry.created_at)}.</p>` : ""}
      ` : `
        <p class="muted">Create a team first, then return here to submit it for this competition.</p>
        <button class="primary" data-jump="teams">Create Team for This Competition</button>
      `}
    </div>
  `;
  bindHoverTilt();
}

async function joinCompetition(title) {
  const select = $("#competitionTeamSelect");
  const teamId = select?.value || "";
  if (!teamId) {
    showToast("Create or select a team before joining this competition.");
    return;
  }
  const response = await apiFetch("/api/competitions/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ competition_title: title, team_id: teamId }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showToast(payload.error || "Competition entry failed.");
    return;
  }
  appData.competition_entries = payload.competition_entries || appData.competition_entries || [];
  renderCompetitions(activeCompetitionIndex);
  showToast(`${payload.entry.team_name} submitted for ${title}.`);
}

function isIncomingRequest(request) {
  return (request.target_email || "").toLowerCase() === (currentProfile.email || "").toLowerCase()
    || (request.target_name || "").toLowerCase() === (currentProfile.name || "").toLowerCase();
}

function requestPartnerLabel(request) {
  return isIncomingRequest(request)
    ? (request.from_email || "Collaborator")
    : (request.target_name || request.target_email || "Collaborator");
}

function requestStatusClass(status = "") {
  const value = status.toLowerCase();
  if (value.includes("accept") || value.includes("active") || value.includes("complete")) return "success";
  if (value.includes("reject") || value.includes("ended")) return "danger";
  if (value.includes("leave")) return "warning";
  return "pending";
}

function requestMatchesFilter(request) {
  if (requestFilter === "all") return true;
  if (requestFilter === "incoming") return isIncomingRequest(request);
  if (requestFilter === "outgoing") return !isIncomingRequest(request);
  return (request.status || "").toLowerCase() === requestFilter;
}

function renderRequestCenter() {
  const el = $("#requestCenter");
  if (!el) return;
  const requests = requestState || [];
  const counts = {
    all: requests.length,
    incoming: requests.filter(isIncomingRequest).length,
    outgoing: requests.filter((item) => !isIncomingRequest(item)).length,
    accepted: requests.filter((item) => (item.status || "").toLowerCase() === "accepted").length,
    rejected: requests.filter((item) => (item.status || "").toLowerCase() === "rejected").length,
  };
  const filtered = requests.filter(requestMatchesFilter);
  el.innerHTML = `
    <div class="request-head">
      <div>
        <h3>Request Center</h3>
        <p class="muted">Accept, reject, and track collaboration requests, team join requests, and recruitment invitations.</p>
      </div>
      <div class="request-tabs">
        ${["all", "incoming", "outgoing", "accepted", "rejected"].map((filter) => `
          <button class="secondary ${requestFilter === filter ? "active" : ""}" type="button" data-request-filter="${filter}">
            ${filter[0].toUpperCase() + filter.slice(1)} (${counts[filter] || 0})
          </button>
        `).join("")}
      </div>
    </div>
    <div class="request-list">
      ${filtered.map((request) => {
        const incoming = isIncomingRequest(request);
        const pending = (request.status || "In Progress") === "In Progress";
        const accepted = (request.status || "").toLowerCase() === "accepted";
        return `
          <article class="request-card ${requestStatusClass(request.status)}">
            <div>
              <span class="status-pill">${request.status || "In Progress"}</span>
              <h4>${incoming ? "Incoming request" : "Outgoing request"}: ${requestPartnerLabel(request)}</h4>
              <p>${request.request_type || "Collaboration Request"} - ${request.target_role || "Collaborator"}</p>
              <p class="muted">${request.team_name || request.project || "Project collaboration"} · ${request.created_at || ""}</p>
            </div>
            <div class="request-actions">
              ${incoming && pending ? `<button class="primary" type="button" data-request-action="Accepted" data-request-id="${request.id}">Accept</button><button class="secondary danger" type="button" data-request-action="Rejected" data-request-id="${request.id}">Reject</button>` : ""}
              ${accepted ? `<button class="secondary" type="button" data-request-action="Completion Requested" data-request-id="${request.id}">Mark Completed</button>` : ""}
            </div>
          </article>
        `;
      }).join("") || `<div class="empty"><div><h3>No requests here</h3><p>Requests you send or receive will appear in this center.</p></div></div>`}
    </div>
  `;
}

function requestToConversation(request) {
  const incoming = isIncomingRequest(request);
  const accepted = (request.status || "").toLowerCase() === "accepted";
  const rejected = (request.status || "").toLowerCase() === "rejected";
  const savedMessages = (appData.chat_messages || [])
    .filter((message) => message.request_id === request.id)
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  return {
    requestId: request.id,
    request,
    accepted,
    locked: !accepted,
    title: accepted ? `Chat with ${requestPartnerLabel(request)}` : `${incoming ? "Request from" : "Request to"} ${requestPartnerLabel(request)}`,
    type: accepted ? "Collaboration Chat Unlocked" : (incoming ? "Incoming Collaboration Request" : "Pending Collaboration"),
    last: `${request.status || "In Progress"} - ${request.team_name || request.project || "Collaboration"}`,
    messages: accepted ? [
      { from: "System", text: "Your collaboration request has been accepted. Chat is now unlocked." },
      { from: "System", text: "You can discuss project goals, roles, schedule, and next steps here." },
      ...savedMessages,
    ] : rejected ? [
      { from: "System", text: "This collaboration request was rejected. It is saved in history." },
    ] : [
      { from: "System", text: incoming ? `${request.from_email || "A collaborator"} sent you a collaboration request. Use Request Center to accept or reject it.` : `Request sent to ${request.target_name || request.target_email || "collaborator"}. Waiting for response.` },
      { from: "System", text: "Chat stays locked until the request is accepted." },
    ],
  };
}

function renderChatMessage(msg) {
  const senderEmail = (msg.sender_email || "").toLowerCase();
  const mine = senderEmail && senderEmail === (currentProfile.email || "").toLowerCase();
  const system = msg.from === "System" || msg.sender_email === "system";
  const name = system ? "System" : (mine ? "You" : (msg.sender_name || msg.sender_email || msg.from || "Collaborator"));
  const type = msg.message_type || "text";
  const text = msg.body || msg.text || "";
  const body = text ? `<div>${escapeHtml(text)}</div>` : "";
  const attachment = msg.file_url
    ? (type === "image"
      ? `<a class="chat-attachment image" href="${escapeAttr(msg.file_url)}" target="_blank" rel="noopener"><img src="${escapeAttr(msg.file_url)}" alt="${escapeAttr(msg.file_name || "Shared image")}" /><span>${escapeHtml(msg.file_name || "Shared image")}</span></a>`
      : `<a class="chat-attachment file" href="${escapeAttr(msg.file_url)}" target="_blank" rel="noopener">Download ${escapeHtml(msg.file_name || "shared file")}</a>`)
    : "";
  return `
    <div class="chat-bubble ${mine ? "me" : ""} ${system ? "system" : ""}">
      <strong>${escapeHtml(name)}</strong>
      ${body}
      ${attachment}
      ${msg.created_at ? `<small>${escapeHtml(msg.created_at)}</small>` : ""}
    </div>
  `;
}

function renderChatRoom(chat) {
  if (!chat) {
    return `<div class="empty"><div><h3>No conversation yet</h3><p>Accept a request or create a team to unlock focused chat.</p></div></div>`;
  }
  const canChat = chat.requestId && chat.accepted;
  return `
    <button class="secondary chat-back" type="button" data-chat-back>Back to Messages</button>
    <div class="chat-head">
      <div>
        <h3>${escapeHtml(chat.title)}</h3>
        <p class="muted">${escapeHtml(chat.type)}</p>
      </div>
      ${canChat ? `
        <div class="chat-call-actions">
          <button class="secondary" type="button" data-call-start="audio" data-call-request-id="${escapeAttr(chat.requestId)}">Voice call</button>
          <button class="secondary" type="button" data-call-start="video" data-call-request-id="${escapeAttr(chat.requestId)}">Video call</button>
        </div>
      ` : ""}
    </div>
    <div class="call-stage" id="callStage" hidden></div>
    <div class="chat-stream">
      ${(chat.messages || []).map(renderChatMessage).join("")}
    </div>
    ${canChat ? `
      <form class="chat-composer" data-chat-request-id="${escapeAttr(chat.requestId)}">
        <input name="body" type="text" placeholder="Type a message..." autocomplete="off" />
        <label class="attach-button">Image<input name="chatFile" type="file" accept="image/*" hidden /></label>
        <label class="attach-button">File<input name="chatFile" type="file" hidden /></label>
        <button class="primary" type="submit">Send</button>
      </form>
      <p class="muted chat-note">Images and files are stored in Link-Up uploads. Voice/video calls use browser WebRTC.</p>
    ` : `
      <div class="locked-chat">
        <strong>Chat locked</strong>
        <p>${chat.request?.status === "Rejected" ? "This request was rejected, so chat stays closed." : "Both sides must accept the request before private chat opens."}</p>
      </div>
    `}
  `;
}

function renderMessages(active = null) {
  activeChatIndex = active;
  renderRequestCenter();
  const requestConversations = (requestState || []).map(requestToConversation);
  const conversations = [...requestConversations, ...appData.conversations];
  const detailMode = active !== null && active !== undefined;
  $(".message-layout")?.classList.toggle("chat-detail-mode", detailMode);
  $("#requestCenter").hidden = detailMode;
  $("#conversationList").innerHTML = conversations.map((chat, i) => `
    <article class="conversation ${i === active ? "active" : ""}" data-chat="${i}">
      <strong>${chat.title}</strong>
      <p>${chat.type} - ${chat.last}</p>
    </article>
  `).join("");
  const chat = detailMode ? conversations[active] : null;
  $("#chatRoom").innerHTML = detailMode ? renderChatRoom(chat) : "";
}

function lifecycleStepsFor(request) {
  const status = request.status || "In Progress";
  if (status === "Rejected") {
    return [
      ["Request Created", "Request was recorded.", "done"],
      ["Rejected", "The receiver declined the collaboration.", "danger"],
      ["History Saved", "The decision stays in request history.", "done"],
    ];
  }
  if (status === "Accepted") {
    return [
      ["Request Created", "A collaboration request was sent.", "done"],
      ["Accepted", "Both sides agreed to collaborate.", "done"],
      ["Chat Unlocked", "The private chat is now open.", "active"],
      ["Working Together", "Teamwork is active.", "active"],
      ["Complete Later", "Mark completed when the work is finished.", ""],
    ];
  }
  if (status === "Completion Requested" || status === "Completed") {
    return [
      ["Request Created", "A collaboration request was sent.", "done"],
      ["Accepted", "Both sides agreed to collaborate.", "done"],
      ["Work Completed", "Completion was requested or confirmed.", "done"],
      ["Outcome Showcase", "Share the result or keep it private.", "active"],
    ];
  }
  return [
    ["Request Created", "A request was sent or received.", "done"],
    ["Waiting Decision", "Receiver chooses Accept or Reject.", "active"],
    ["Chat Locked", "No private chat before acceptance.", ""],
    ["Accepted Later", "If accepted, chat and collaboration begin.", ""],
  ];
}

function renderLifecycle() {
  const requests = requestState || [];
  $("#timeline").innerHTML = requests.length ? requests.map((request) => `
    <article class="lifecycle-card ${requestStatusClass(request.status)}">
      <div class="lifecycle-card-head">
        <div>
          <span class="status-pill">${request.status || "In Progress"}</span>
          <h3>${requestPartnerLabel(request)}</h3>
          <p>${request.request_type || "Collaboration Request"} · ${request.team_name || request.project || "Project collaboration"}</p>
        </div>
      </div>
      <div class="lifecycle-steps">
        ${lifecycleStepsFor(request).map(([title, body, state]) => `<div class="timeline-item ${state}"><strong>${title}</strong><p>${body}</p></div>`).join("")}
      </div>
    </article>
  `).join("") : `<div class="empty"><div><h3>No lifecycle record yet</h3><p>When you send, receive, accept, or reject a request, it will appear here as a clear collaboration timeline.</p></div></div>`;
}

async function updateRequestStatus(id, status) {
  const response = await apiFetch("/api/requests/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showToast(payload.error || "Unable to update request.");
    return;
  }
  requestState = payload.requests || requestState;
  renderMessages(null);
  renderLifecycle();
  showToast(`Request ${status.toLowerCase()}.`);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function sendChatMessage(form) {
  const requestId = form.dataset.chatRequestId;
  const body = new FormData(form).get("body") || "";
  const file = [...form.querySelectorAll('input[type="file"]')]
    .map((input) => input.files?.[0])
    .find(Boolean);
  const payload = {
    request_id: requestId,
    body,
    message_type: "text",
  };
  if (file) {
    payload.file_name = file.name;
    payload.file_kind = file.type || "application/octet-stream";
    payload.file_data = await fileToDataUrl(file);
  }
  const response = await apiFetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "Message could not be sent.");
    return;
  }
  appData.chat_messages = result.messages || appData.chat_messages || [];
  form.reset();
  renderMessages(activeChatIndex);
}

async function refreshChatMessages(silent = true) {
  if (!authToken) return;
  try {
    const response = await apiFetch("/api/messages");
    if (!response.ok) return;
    const result = await response.json();
    const before = JSON.stringify(appData.chat_messages || []);
    appData.chat_messages = result.messages || [];
    if (JSON.stringify(appData.chat_messages || []) !== before) {
      renderMessages(activeChatIndex);
      if (!silent) showToast("Chat updated.");
    }
  } catch (error) {
    console.warn("Chat polling failed", error);
  }
}

function startChatPolling() {
  if (chatPoller) clearInterval(chatPoller);
  chatPoller = setInterval(() => refreshChatMessages(true), 5000);
}

async function sendCallSignal(requestId, signalType, payload = {}) {
  await apiFetch("/api/calls/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId, signal_type: signalType, payload }),
  });
}

function renderCallStage(type, status = "Connecting...") {
  const stage = $("#callStage");
  if (!stage) return;
  stage.hidden = false;
  stage.innerHTML = `
    <div class="call-panel ${type}">
      <div class="call-panel-head">
        <div>
          <strong>${type === "video" ? "Video call" : "Voice call"}</strong>
          <p class="muted" id="callStatus">${escapeHtml(status)}</p>
        </div>
        <button class="secondary danger" type="button" data-call-end>End call</button>
      </div>
      <div class="call-media">
        <video id="localVideo" autoplay muted playsinline></video>
        <video id="remoteVideo" autoplay playsinline></video>
      </div>
    </div>
  `;
}

function setCallStatus(status) {
  const el = $("#callStatus");
  if (el) el.textContent = status;
}

function stopActiveCall(sendEnd = true) {
  if (!activeCall) return;
  if (sendEnd) sendCallSignal(activeCall.requestId, "end", {});
  if (activeCall.poller) clearInterval(activeCall.poller);
  activeCall.stream?.getTracks?.().forEach((track) => track.stop());
  activeCall.pc?.close?.();
  activeCall = null;
  const stage = $("#callStage");
  if (stage) {
    stage.innerHTML = "";
    stage.hidden = true;
  }
}

async function pollCallSignals() {
  if (!activeCall) return;
  const response = await apiFetch(`/api/calls/signals?request_id=${encodeURIComponent(activeCall.requestId)}`);
  if (!response.ok) return;
  const result = await response.json();
  for (const signal of result.signals || []) {
    if (activeCall.seen.has(signal.id)) continue;
    activeCall.seen.add(signal.id);
    await handleCallSignal(signal);
  }
}

async function handleCallSignal(signal) {
  if (!activeCall) return;
  const pc = activeCall.pc;
  const payload = signal.payload || {};
  if (signal.signal_type === "end") {
    setCallStatus("The other user ended the call.");
    stopActiveCall(false);
    return;
  }
  if (signal.signal_type === "ice" && payload.candidate) {
    try {
      await pc.addIceCandidate(payload.candidate);
    } catch (error) {
      console.warn("ICE candidate failed", error);
    }
    return;
  }
  if (signal.signal_type === "offer" && payload.description) {
    const offerCollision = activeCall.makingOffer || pc.signalingState !== "stable";
    const polite = (currentProfile.email || "") > (signal.sender_email || "");
    if (offerCollision && !polite) return;
    if (offerCollision) await pc.setLocalDescription({ type: "rollback" });
    await pc.setRemoteDescription(payload.description);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendCallSignal(activeCall.requestId, "answer", { description: pc.localDescription });
    setCallStatus("Connected. Waiting for media stream...");
    return;
  }
  if (signal.signal_type === "answer" && payload.description && pc.signalingState === "have-local-offer") {
    await pc.setRemoteDescription(payload.description);
    setCallStatus("Connected.");
  }
}

async function startRealCall(requestId, type) {
  stopActiveCall(false);
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    showToast("This browser does not support real-time calls.");
    return;
  }
  renderCallStage(type, "Requesting microphone/camera permission...");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    activeCall = {
      requestId,
      type,
      pc,
      stream,
      seen: new Set(),
      makingOffer: false,
      poller: null,
    };
    const localVideo = $("#localVideo");
    if (localVideo) {
      localVideo.srcObject = stream;
      localVideo.classList.toggle("audio-only", type !== "video");
    }
    pc.ontrack = (event) => {
      const remoteVideo = $("#remoteVideo");
      if (remoteVideo) remoteVideo.srcObject = event.streams[0];
      setCallStatus("Connected.");
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) sendCallSignal(requestId, "ice", { candidate: event.candidate });
    };
    pc.onconnectionstatechange = () => {
      setCallStatus(`Call status: ${pc.connectionState}`);
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        setTimeout(() => stopActiveCall(false), 1200);
      }
    };
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    activeCall.poller = setInterval(pollCallSignals, 1200);
    await pollCallSignals();
    if (pc.signalingState !== "stable") {
      setCallStatus("Answering incoming call...");
      return;
    }
    activeCall.makingOffer = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    activeCall.makingOffer = false;
    await sendCallSignal(requestId, "offer", { description: pc.localDescription, call_type: type });
    setCallStatus("Calling. Ask the other user to open this chat and press the same call button.");
  } catch (error) {
    stopActiveCall(false);
    showToast(`Call could not start: ${error.message || error}`);
  }
}

function renderProfile() {
  $("#profilePreview").innerHTML = `
    <div class="avatar">${currentProfile.name.split(" ").map((p) => p[0]).slice(0,2).join("")}</div>
    <h3>${currentProfile.name}</h3>
    <p>${currentProfile.role} - ${currentProfile.organisation_type || "Collaborator"}</p>
    <p class="muted">${currentProfile.institution || "Institution not selected"}</p>
    <p class="muted">${currentProfile.major || "Major not added"}${currentProfile.graduation_year ? ` - Class of ${currentProfile.graduation_year}` : ""}</p>
    <p>${currentProfile.bio || "No self introduction yet."}</p>
    ${chips(currentProfile.skills)}
    <div class="trust-grid">
      <span><strong>${currentProfile.verification_status || "Profile verified"}</strong> verification</span>
      <span><strong>${currentProfile.reliability_score || "82"}/100</strong> reliability</span>
      <span><strong>${displayList(currentProfile.availability || "Not set")}</strong> availability</span>
    </div>
    <p class="explain"><strong>Profile sync:</strong> Role, school/company, availability, interests and credibility signals are used by AI Matching and saved through the backend.</p>
  `;
}

function renderProfileContext() {
  const el = $("#profileContext");
  if (!el) return;
  el.innerHTML = `
    <strong>Profile context used automatically</strong>
    <p class="muted">Your role, availability, interests and communication style are loaded from Profile. They are used as secondary matching signals, while the teammate role and skills selected above have higher priority.</p>
    <div class="chip-row">
      <span>${currentProfile.role}</span>
      <span>${currentProfile.institution || "No institution"}</span>
      ${splitList(currentProfile.availability).map((item) => `<span>${item}</span>`).join("")}
      ${splitList(currentProfile.communication_style).map((item) => `<span>${item}</span>`).join("")}
    </div>
  `;
}

function showToast(message) {
  let toast = $("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

document.addEventListener("click", (event) => {
  const pickerToggle = event.target.closest(".multi-picker-toggle");
  if (pickerToggle) {
    const picker = pickerToggle.closest(".multi-picker");
    const menu = picker.querySelector(".multi-picker-menu");
    const willOpen = menu.hidden;
    closeOtherMultiPickers(picker);
    menu.hidden = !willOpen;
    picker.classList.toggle("open", willOpen);
    pickerToggle.setAttribute("aria-expanded", String(willOpen));
    event.preventDefault();
    return;
  }

  if (!event.target.closest(".multi-picker")) closeOtherMultiPickers();

  const nav = event.target.closest("[data-view]");
  if (nav) switchView(nav.dataset.view);

  const jump = event.target.closest("[data-jump]");
  if (jump) switchView(jump.dataset.jump);

  const mode = event.target.closest("[data-mode]");
  if (mode) {
    currentMode = mode.dataset.mode;
    $$("[data-mode]").forEach((button) => button.classList.toggle("active", button === mode));
    renderRecruitPanel();
    renderMatchingForm();
    renderEmptyMatches();
  }

  const searchButton = event.target.closest("[data-search-type]");
  if (searchButton) {
    searchType = searchButton.dataset.searchType;
    $$("[data-search-type]").forEach((button) => button.classList.toggle("active", button === searchButton));
    manualFilters = { role: "", skill: "", project: "", institution: "" };
    renderSearchFilters();
    renderSearch();
  }

  const filterControl = event.target.closest("[data-manual-filter]");
  if (filterControl) {
    manualFilters[filterControl.dataset.manualFilter] = filterControl.value;
    renderSearch();
  }

  const requestFilterButton = event.target.closest("[data-request-filter]");
  if (requestFilterButton) {
    requestFilter = requestFilterButton.dataset.requestFilter;
    renderRequestCenter();
  }

  const requestActionButton = event.target.closest("[data-request-action]");
  if (requestActionButton) {
    updateRequestStatus(requestActionButton.dataset.requestId, requestActionButton.dataset.requestAction);
  }

  if (event.target.closest("#clearManualFilters")) {
    manualFilters = { role: "", skill: "", project: "", institution: "" };
    renderSearchFilters();
    renderSearch();
  }

  const competition = event.target.closest("[data-competition]");
  if (competition) renderCompetitions(Number(competition.dataset.competition));

  const joinCompetitionButton = event.target.closest("[data-join-competition]");
  if (joinCompetitionButton) joinCompetition(joinCompetitionButton.dataset.joinCompetition);

  const editTeamButton = event.target.closest("[data-edit-team]");
  if (editTeamButton) editTeam(editTeamButton.dataset.editTeam);

  const recruitTeamButton = event.target.closest("[data-recruit-team]");
  if (recruitTeamButton) recruitForTeam(recruitTeamButton.dataset.recruitTeam);

  const chat = event.target.closest("[data-chat]");
  if (chat) renderMessages(Number(chat.dataset.chat));

  if (event.target.closest("[data-chat-back]")) {
    stopActiveCall(true);
    renderMessages(null);
  }

  const callStart = event.target.closest("[data-call-start]");
  if (callStart) startRealCall(callStart.dataset.callRequestId, callStart.dataset.callStart);

  if (event.target.closest("[data-call-end]")) stopActiveCall(true);

  const profileButton = event.target.closest("[data-profile-email]");
  if (profileButton) openManualProfile(profileButton.dataset.profileEmail);

  const requestButton = event.target.closest("[data-send-request]");
  if (requestButton) sendRequest(requestButton.dataset.sendRequest, requestButton.dataset.role, requestButton.dataset.targetEmail || "", requestButton.dataset.requestType || "");

  const readButton = event.target.closest("[data-read-explanation]");
  if (readButton) speakText(readButton.dataset.readExplanation);

  if (event.target.closest("#applyPreferences")) {
    applyPreferences();
  }
});

document.addEventListener("submit", (event) => {
  const composer = event.target.closest(".chat-composer");
  if (!composer) return;
  event.preventDefault();
  sendChatMessage(composer);
});

document.addEventListener("change", (event) => {
  const pickerOption = event.target.closest(".multi-picker-option input");
  if (pickerOption) {
    syncPickerToSelect(pickerOption.closest(".multi-picker"));
    return;
  }

  const filterControl = event.target.closest("[data-manual-filter]");
  if (filterControl) {
    manualFilters[filterControl.dataset.manualFilter] = filterControl.value;
    renderSearch();
  }
});

document.querySelector('[data-auth-view="login"]').addEventListener("click", () => showAuthView("login"));
document.querySelector('[data-auth-view="register"]').addEventListener("click", () => showAuthView("register"));
$$('[data-auth-view="welcome"]').forEach((button) => button.addEventListener("click", () => showAuthView("welcome")));
$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const draft = Object.fromEntries(new FormData(event.currentTarget).entries());
  $("#authStatus").textContent = "Checking password and sending OTP...";
  const response = await fetch("/api/request-login-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const payload = await response.json();
  if (!response.ok) {
    $("#authStatus").textContent = payload.error || "Login OTP failed.";
    return;
  }
  pendingAuth = { type: "login", draft };
  $("#otpIntro").textContent = `Enter the OTP sent to ${payload.email}.`;
  $("#otpMessage").innerHTML = payload.otp_demo
    ? `Demo OTP: <strong>${payload.otp_demo}</strong>. It expires in ${payload.expires_in_minutes} minutes.`
    : `OTP has been sent to ${payload.email}. It expires in ${payload.expires_in_minutes} minutes.`;
  $("#otpForm").reset();
  showAuthView("otp");
});
$("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const draft = Object.fromEntries(new FormData(event.currentTarget).entries());

  $("#authStatus").textContent = "Creating verification code...";

  const response = await fetch("/api/request-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draft),
  });

  const payload = await response.json();

  if (!response.ok) {
    $("#authStatus").textContent = payload.error || "Registration OTP failed.";
    return;
  }

  pendingAuth = {
    type: "register",
    draft,
  };

  $("#otpIntro").textContent = `Enter the OTP sent to ${payload.email}.`;
  $("#otpMessage").innerHTML = payload.otp_demo
    ? `Demo OTP: <strong>${payload.otp_demo}</strong>. It expires in ${payload.expires_in_minutes} minutes.`
    : `OTP has been sent to ${payload.email}. It expires in ${payload.expires_in_minutes} minutes.`;
  $("#otpForm").reset();

  showAuthView("otp");
});
$("#otpForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!pendingAuth) {
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    showAuthView("welcome");
    return;
  }

  const otp = new FormData(event.currentTarget).get("otp");
  const endpoint = pendingAuth.type === "login" ? "/api/verify-login-otp" : "/api/register";

  $("#authStatus").textContent = "Verifying OTP...";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...pendingAuth.draft,
      otp,
    }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.authenticated) {
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    $("#authStatus").textContent = payload.error || "OTP verification failed.";
    return;
  }

  applyAuthenticatedSession(payload);

  if (!authToken) {
    $("#authStatus").textContent = "Login token was not received. Please try again.";
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    showAuthView("login");
    return;
  }

  if (pendingAuth.type === "register" || profileNeedsSetup(payload.profile)) {
    fillFirstProfileForm();
    pendingAuth = null;
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    showAuthView("profile");
    return;
  }

  pendingAuth = null;
  await enterWorkspace();
  showToast(`Welcome back, ${payload.profile?.name || payload.email}.`);
});
$("#resendOtp").addEventListener("click", async () => {
  if (!pendingAuth) return;
  const endpoint = pendingAuth.type === "login" ? "/api/request-login-otp" : "/api/request-otp";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pendingAuth.draft),
  });
  const payload = await response.json();
  if (!response.ok) {
    $("#authStatus").textContent = payload.error || "Could not resend OTP.";
    return;
  }
  $("#otpMessage").innerHTML = payload.otp_demo
    ? `New demo OTP: <strong>${payload.otp_demo}</strong>. It expires in ${payload.expires_in_minutes} minutes.`
    : `A new OTP has been sent to ${payload.email}. It expires in ${payload.expires_in_minutes} minutes.`;
});
$("#firstProfileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  currentProfile = { ...currentProfile, ...formValues(event.currentTarget) };
  const response = await apiFetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentProfile),
  });
  const payload = await response.json();
  if (!response.ok || !payload.saved) {
    $("#authStatus").textContent = payload.error || "Profile save failed.";
    return;
  }
  pendingAuth = null;
  currentProfile = payload.profile || currentProfile;
  await enterWorkspace();
  showToast("Profile completed. Welcome to Link-Up.");
});
$("#logoutButton").addEventListener("click", async () => {
  stopActiveCall(true);
  if (chatPoller) clearInterval(chatPoller);
  chatPoller = null;
  try {
    await apiFetch("/api/logout", {
      method: "POST",
    });
  } catch (error) {
    console.warn("Logout request failed, clearing local session anyway.", error);
  }

  authToken = "";
  pendingAuth = null;
  localStorage.removeItem("linkup_auth_token");

  document.body.classList.remove("authenticated");
  document.body.classList.add("auth-locked");

  $("#signedInName").textContent = "Guest";
  $("#signedInEmail").textContent = "Not signed in";

  showAuthView("welcome");
  showToast("Logged out.");
});

$("#runMatch").addEventListener("click", runMatching);
$("#voiceAssistant").addEventListener("click", runVoiceAssistant);
$("#voiceAssistant").addEventListener("pointerdown", startAssistantDrag);
$("#voiceAssistant").addEventListener("pointermove", moveAssistantDrag);
$("#voiceAssistant").addEventListener("pointerup", endAssistantDrag);
$("#voiceAssistant").addEventListener("pointercancel", endAssistantDrag);
window.addEventListener("resize", () => {
  const button = $("#voiceAssistant");
  if (button) setAssistantPosition(button.offsetLeft, button.offsetTop);
});
window.addEventListener("hashchange", syncAuthRouteFromHash);
$("#openIntroGuide").addEventListener("click", openIntroGuide);
$("#openIntroGuideInline").addEventListener("click", openIntroGuide);
$("#closeIntroGuide").addEventListener("click", () => {
  pauseIntro();
  $("#introDialog").close();
});
$("#introPlayPause").addEventListener("click", () => {
  if (introPlaying) pauseIntro();
  else playIntroStep();
});
$("#introPrev").addEventListener("click", () => moveIntro(-1));
$("#introNext").addEventListener("click", () => moveIntro(1));
$("#introMute").addEventListener("click", () => {
  introMuted = !introMuted;
  if (introMuted) stopSpeech();
  renderIntroStep();
});
$("#introDialog").addEventListener("close", pauseIntro);
$("#configureGemini").addEventListener("click", () => {
  $("#geminiSaveStatus").textContent = "";
  $("#geminiDialog").showModal();
});
$("#saveGeminiKey").addEventListener("click", async (event) => {
  event.preventDefault();
  const key = $("#geminiKeyInput").value.trim();
  if (!key) {
    $("#geminiSaveStatus").textContent = "Please paste your Gemini API key first.";
    return;
  }
  const response = await apiFetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gemini_api_key: key }),
  });
  const payload = await response.json();
  if (payload.saved) {
    $("#geminiSaveStatus").textContent = "Gemini key saved. Gemini is now configured.";
    $("#geminiKeyInput").value = "";
    await refreshAiStatus();
    showToast("Gemini key saved locally. Run AI Matching again.");
    setTimeout(() => $("#geminiDialog").close(), 700);
  } else {
    $("#geminiSaveStatus").textContent = payload.error || "Failed to save Gemini key.";
  }
});
$("#searchInput").addEventListener("input", renderSearch);
$("#teamForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
  formData.open_roles = collectChoice("team_roles");
  formData.role_counts = collectTeamRoleCounts();
  formData.size = String(Math.min(10, Math.max(2, Number(formData.size || 5))));
  if (!formData.open_roles) {
    showToast("Select at least one open role before publishing the team.");
    return;
  }
  if (teamRoleCountTotal(formData.role_counts) > Number(formData.size)) {
    showToast("Open role quantity cannot be higher than the team size.");
    return;
  }
  const response = await apiFetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  const payload = await response.json();
  appData.my_teams = payload.my_teams || appData.my_teams || [];
  selectedTeamId = payload.team?.id || selectedTeamId;
  setFieldValue(event.currentTarget.elements.id, payload.team?.id || "");
  $("#saveTeamButton").textContent = "Save Team Changes";
  $("#cancelTeamEdit").hidden = false;
  renderTeams();
  renderCompetitions(activeCompetitionIndex);
  renderRecruitPanel();
  if (currentMode === "recruit") renderMatchingForm();
  showToast(`${payload.team.team_name} saved. Recruit mode is now unlocked.`);
});
$("#cancelTeamEdit").addEventListener("click", resetTeamForm);
$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  currentProfile = { ...currentProfile, ...formValues(event.currentTarget) };
  const response = await apiFetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentProfile),
  });
  const payload = await response.json();
  $("#profileSaveStatus").textContent = payload.saved ? "Profile saved and synced to matching data." : "Profile save failed.";
  renderProfile();
  renderProfileContext();
});
$$('[data-name="team_roles"] input').forEach((input) => input.addEventListener("change", renderTeams));
$$('[data-name="team_roles"] .role-count').forEach((input) => input.addEventListener("input", renderTeams));

checkSession();
restoreAssistantPosition();
setupIntroVideoFallback();
