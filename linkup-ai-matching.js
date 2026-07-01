let appData = { users: [], teams: [], competitions: [], conversations: [] };
let currentMode = "individual";
let searchType = "people";
let selectedTeamId = "";
let currentRecruitRole = "";
let appliedIntent = null;
let manualFilters = { role: "", skill: "", project: "" };
let introIndex = 0;
let introPlaying = false;
let introMuted = false;
let activeSpeechSource = "";
let speechToken = 0;
let suppressNextAssistantClick = false;
let assistantDragState = null;
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
  portfolio: "Campus AI Assistant;Course Planner UI;Hackathon Landing Page",
  badges: "First Collaboration;Active Contributor",
};
let requestState = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const projectTypes = ["AI Product", "Web App", "Mobile App", "Research Project", "Competition", "Startup", "Data Platform", "VR Experience", "Cybersecurity Tool", "E-commerce", "FinTech", "HealthTech"];
const roles = ["Frontend Developer", "Backend Engineer", "Full Stack Developer", "Machine Learning Engineer", "Data Processing Engineer", "Data Analyst", "UI/UX Designer", "Product Designer", "Product Manager", "Cloud Engineer", "DevOps Engineer", "Mobile Developer", "AR/VR Developer", "Cybersecurity Analyst", "QA Tester", "Business Analyst", "AI Prompt Engineer", "Pitch Presenter", "Content Strategist"];
const skills = ["React", "Vue", "HTML/CSS", "JavaScript", "TypeScript", "Python", "Java", "C#", "Node.js", "Express", "APIs", "SQL", "NoSQL", "MongoDB", "Cloud Database", "Firebase", "AWS", "Docker", "GitHub Actions", "TensorFlow", "PyTorch", "Machine Learning", "Data Processing", "Data Visualization", "Power BI", "Figma", "Wireframing", "Prototyping", "User Research", "Accessibility", "Flutter", "React Native", "Unity", "VR Interaction", "Cybersecurity", "Testing", "Agile", "Presentation", "Pitch Deck", "Market Research", "Documentation", "AI Prompting", "Storytelling", "Content Writing", "Social media"];
const directions = ["AI startups", "Hackathons", "EdTech", "Research", "Social impact", "Open source", "Smart campus", "HealthTech", "Sustainability", "FinTech", "E-commerce", "Cybersecurity", "Virtual reality", "Data analytics", "Accessibility", "Student productivity", "Startup validation"];
const teamStages = ["Idea validation", "User research", "Prototype building", "MVP development", "Competition preparation", "Research and report", "Pitch preparation", "Testing and QA", "Launch preparation"];
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
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  speechToken += 1;
  activeSpeechSource = "";
  $("#voiceAssistant")?.classList.remove("speaking");
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
    ? [item.team_name, item.idea, item.project_type, item.open_roles, item.status].join(" ")
    : [item.name, item.role, item.experience, item.skills, item.interests, item.project_types, item.goals, item.portfolio, item.badges].join(" ");
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
  const response = await fetch("/api/data");
  appData = await response.json();
  currentProfile = appData.profile || currentProfile;
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
  [...form.elements].forEach((field) => {
    if (field.name && currentProfile[field.name] !== undefined) {
      field.value = currentProfile[field.name];
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
        <label>Project type for this search
          <select name="project_type">${optionList(projectTypes, "AI Product")}</select>
        </label>
        <label>Matching priority
          <select name="priority">
            <option value="role_first">Role fit first</option>
            <option value="skill_first">Skill coverage first</option>
            <option value="availability_first">Availability first</option>
            <option value="balanced">Balanced recommendation</option>
          </select>
        </label>
      </div>
      ${choiceSet("preferred_roles", "Preferred teammate roles", roles)}
      ${choiceSet("skills", "Must-have teammate skills", skills)}
      ${choiceSet("interests", "Preferred project direction", directions)}
      ${applyBox("No individual matching preferences confirmed yet.")}
    `;
  } else if (currentMode === "team") {
    html = `
      <div class="mode-note">
        <strong>Team joining search</strong>
        <p class="muted">This mode searches teams, so the questions focus on the target team theme, open role, stage and team goals.</p>
      </div>
      <div class="form-grid">
        <label>Target team theme
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
            <option value="balanced">Balanced team fit</option>
          </select>
        </label>
      </div>
      ${choiceSet("preferred_roles", "Role you want to take in a team", roles)}
      ${choiceSet("goals", "Target team goals", teamStages)}
      ${choiceSet("interests", "Team topic interests", directions)}
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
        <label>Team project type
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
            <option value="balanced">Balanced recommendation</option>
          </select>
        </label>
      </div>
      ${choiceSet("skills", `Required skills for ${currentRecruitRole}`, skillsForRole(currentRecruitRole), recommendedSkills)}
      ${choiceSet("interests", "Applicant interest fit", directions)}
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
  const response = await fetch("/api/match", {
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
  return `
    <article class="match-card">
      <div class="match-top">
        <div class="score" style="--score:${match.score}%"><span>${match.score}%</span></div>
        <div>
          <h3>${title}</h3>
          <p class="muted">${role} - ${displayList(match.availability || match.project_type || "Active recruitment")}</p>
          ${chips(match.skills || match.open_roles || match.interests)}
        </div>
        <button class="secondary" data-send-request="${title}" data-role="${role}">Send request</button>
      </div>
      <p class="explain"><strong>Explainable AI reason:</strong> ${match.explanation}</p>
      <button class="secondary audio-action" type="button" data-read-explanation="${escapeAttr(`${title}. ${match.explanation}`)}">Read AI Explanation</button>
    </article>
  `;
}

async function sendRequest(name, role) {
  const team = (appData.my_teams || []).find((item) => item.id === selectedTeamId);
  const response = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_name: name,
      target_role: role,
      project: currentMode === "recruit" && team ? team.idea : "AI Product Collaboration",
      team_name: team ? team.team_name : "",
    }),
  });
  const payload = await response.json();
  requestState = payload.requests || requestState;
  appData.conversations.unshift({
    title: name,
    type: "Pending Collaboration",
    last: "Request sent. Chat unlocks after acceptance.",
    messages: [
      { from: "System", text: `Collaboration request sent to ${name}. Waiting for response.` },
      { from: "System", text: "Private chat is locked until both users agree to collaborate." },
    ],
  });
  renderMessages(0);
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
  const projectLabel = searchType === "teams" ? "Team theme" : "Project type";
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
    return queryPass && rolePass && skillPass && projectPass;
  }).slice(0, 18);
  $("#searchResults").innerHTML = filtered.map((item) => {
    if (searchType === "teams") {
      return `<article class="team-card"><h3>${item.team_name}</h3><p>${item.idea}</p>${chips(item.open_roles)}<button class="secondary">Apply to Join</button></article>`;
    }
    const action = searchType === "invite" ? "Invite to Team" : "View Profile";
    const actionAttr = searchType === "invite" ? `data-send-request="${item.name}" data-role="${item.role}"` : `data-profile-email="${item.email}"`;
    return `<article class="person-card"><h3>${item.name}</h3><p>${item.role} - ${item.experience}</p>${chips(item.skills)}<button class="secondary" ${actionAttr}>${action}</button></article>`;
  }).join("") || `<div class="empty"><div><h3>No result found</h3><p>Try another role, skill, project direction, or abbreviation such as ML / UI UX.</p></div></div>`;
  bindHoverTilt();
}

function openManualProfile(email) {
  const person = appData.users.find((user) => user.email === email);
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
    <div class="dialog-actions">
      <button class="secondary" type="button" id="closeProfileDialog">Close</button>
      <button class="primary" type="button" data-send-request="${person.name}" data-role="${person.role}">Send Collaboration Request</button>
    </div>
  `;
  $("#profileDialog").showModal();
  $("#closeProfileDialog").addEventListener("click", () => $("#profileDialog").close(), { once: true });
}

function renderTeams() {
  const form = $("#teamForm");
  const values = form ? Object.fromEntries(new FormData(form).entries()) : {};
  const roles = collectChoice("team_roles") || "ML Engineer;Backend Engineer;UI/UX Designer";
  const owned = (appData.my_teams || []).map((team) => `
    <div class="conversation">
      <strong>${team.team_name}</strong>
      <p>${team.idea}</p>
      ${chips(team.open_roles)}
    </div>
  `).join("");
  $("#teamPreview").innerHTML = `
    <h3>${values.team_name || "New Team"}</h3>
    <p>${values.idea || "Describe your project idea."}</p>
    ${chips(roles)}
    <p class="explain"><strong>Published:</strong> Team recruitment post is ready. AI can recommend applicants for these roles.</p>
    <h3>Your saved teams</h3>
    ${owned || '<p class="muted">No saved team yet. Publish one to unlock teammate recruitment mode.</p>'}
  `;
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
  $("#competitionList").innerHTML = appData.competitions.map((item, i) => `
    <article class="competition-card" data-competition="${i}">
      <h3>${item.title}</h3>
      <p>${item.theme}</p>
      <span class="tag">${item.reward}</span>
    </article>
  `).join("");
  const item = appData.competitions[index] || appData.competitions[0];
  $("#competitionDetail").innerHTML = `
    <h3>${item.title}</h3>
    <p>${item.introduction}</p>
    <h3>Requirements</h3>
    <p>${item.requirements}</p>
    <h3>Reward</h3>
    <p>${item.reward}</p>
    <h3>Existing teams</h3>
    ${(item.teams || []).map((team) => `<div class="conversation"><strong>${team}</strong><p>Recruiting members now.</p><button class="secondary">Apply to Join</button></div>`).join("")}
    <button class="primary" data-jump="teams">Create Team for This Competition</button>
  `;
  bindHoverTilt();
}

function renderMessages(active = 0) {
  const requestConversations = requestState.map((request) => ({
    title: request.target_name || request.name,
    type: "Pending Collaboration",
    last: `${request.status} - ${request.team_name || request.project}`,
    messages: [
      { from: "System", text: `Request sent to ${request.target_name || request.name}. Waiting for response.` },
      { from: "System", text: "Chat is locked until the collaboration request is accepted." },
    ],
  }));
  const conversations = [...requestConversations, ...appData.conversations];
  $("#conversationList").innerHTML = conversations.map((chat, i) => `
    <article class="conversation ${i === active ? "active" : ""}" data-chat="${i}">
      <strong>${chat.title}</strong>
      <p>${chat.type} - ${chat.last}</p>
    </article>
  `).join("");
  const chat = conversations[active] || conversations[0];
  $("#chatRoom").innerHTML = `
    <h3>${chat.title}</h3>
    <p class="muted">${chat.type}</p>
    ${(chat.messages || []).map((msg) => `<div class="chat-bubble ${msg.from === "You" ? "me" : ""}"><strong>${msg.from}</strong><br>${msg.text}</div>`).join("")}
  `;
}

function renderLifecycle() {
  const latest = requestState[0];
  const steps = latest ? [
    ["Request Sent", `Request sent to ${latest.target_name || latest.name}.`, "done"],
    ["Waiting Response", "Chat is locked until the request is accepted.", "active"],
    ["Active Collaboration", "Starts after acceptance.", ""],
    ["Completion Request", "Both sides confirm project completion.", ""],
    ["Outcome Showcase", "Share result to profile or keep private.", ""],
  ] : [
    ["Request Sent", "Collaboration request is pending.", "done"],
    ["Accepted", "Chat and team workspace unlocked.", "done"],
    ["Active Collaboration", "Project work is currently active.", "active"],
    ["Completion Request", "One side can mark the project as completed.", ""],
    ["Outcome Showcase", "Completed work can be shared to portfolio.", ""],
  ];
  $("#timeline").innerHTML = steps.map(([title, body, state]) => `<article class="timeline-item ${state}"><strong>${title}</strong><p>${body}</p></article>`).join("");
}

function renderProfile() {
  $("#profilePreview").innerHTML = `
    <div class="avatar">${currentProfile.name.split(" ").map((p) => p[0]).slice(0,2).join("")}</div>
    <h3>${currentProfile.name}</h3>
    <p>${currentProfile.role} - AI Product Builder</p>
    ${chips(currentProfile.skills)}
    <p class="explain"><strong>Profile sync:</strong> These values are used by AI Matching and saved through the backend.</p>
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
    manualFilters = { role: "", skill: "", project: "" };
    renderSearchFilters();
    renderSearch();
  }

  const filterControl = event.target.closest("[data-manual-filter]");
  if (filterControl) {
    manualFilters[filterControl.dataset.manualFilter] = filterControl.value;
    renderSearch();
  }

  if (event.target.closest("#clearManualFilters")) {
    manualFilters = { role: "", skill: "", project: "" };
    renderSearchFilters();
    renderSearch();
  }

  const competition = event.target.closest("[data-competition]");
  if (competition) renderCompetitions(Number(competition.dataset.competition));

  const chat = event.target.closest("[data-chat]");
  if (chat) renderMessages(Number(chat.dataset.chat));

  const profileButton = event.target.closest("[data-profile-email]");
  if (profileButton) openManualProfile(profileButton.dataset.profileEmail);

  const requestButton = event.target.closest("[data-send-request]");
  if (requestButton) sendRequest(requestButton.dataset.sendRequest, requestButton.dataset.role);

  const readButton = event.target.closest("[data-read-explanation]");
  if (readButton) speakText(readButton.dataset.readExplanation);

  if (event.target.closest("#applyPreferences")) {
    applyPreferences();
  }
});

document.addEventListener("change", (event) => {
  const filterControl = event.target.closest("[data-manual-filter]");
  if (filterControl) {
    manualFilters[filterControl.dataset.manualFilter] = filterControl.value;
    renderSearch();
  }
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
$("#openIntroGuide").addEventListener("click", () => {
  introIndex = 0;
  introPlaying = false;
  renderIntroStep();
  $("#introDialog").showModal();
});
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
  const response = await fetch("/api/settings", {
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
  const response = await fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  const payload = await response.json();
  appData.my_teams = payload.my_teams || appData.my_teams || [];
  selectedTeamId = payload.team?.id || selectedTeamId;
  renderTeams();
  renderRecruitPanel();
  if (currentMode === "recruit") renderMatchingForm();
  showToast(`${payload.team.team_name} saved. Recruit mode is now unlocked.`);
});
$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  currentProfile = { ...currentProfile, ...Object.fromEntries(new FormData(event.currentTarget).entries()) };
  const response = await fetch("/api/profile", {
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

loadData();
restoreAssistantPosition();


