from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from pathlib import Path
import csv
import json
import os
import time
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "users.csv"
PROFILE_PATH = ROOT / "profile.csv"
TEAMS_PATH = ROOT / "teams.csv"
REQUESTS_PATH = ROOT / "requests.csv"
KEY_PATH = ROOT / "gemini_api_key.txt"
PORT = int(os.environ.get("LINKUP_PORT", "4173"))
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
GEMINI_MODEL_FALLBACKS = [
    model.strip()
    for model in os.environ.get(
        "GEMINI_MODEL_FALLBACKS",
        f"{GEMINI_MODEL},gemini-3.5-flash,gemini-3.1-flash-lite-preview,gemini-2.5-flash-lite,gemini-2.5-flash"
    ).split(",")
    if model.strip()
]
LAST_GEMINI_ERROR = ""
LAST_GEMINI_MODEL_USED = GEMINI_MODEL


def load_gemini_key():
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_key:
        return env_key
    if KEY_PATH.exists():
        return KEY_PATH.read_text(encoding="utf-8").strip()
    return ""


GEMINI_KEY = load_gemini_key()

HEADERS = [
    "id", "name", "email", "role", "experience", "skills", "interests",
    "project_types", "preferred_roles", "availability", "working_style",
    "communication_style", "goals", "portfolio", "badges"
]

TEAM_HEADERS = ["id", "owner_email", "team_name", "idea", "project_type", "team_size", "open_roles", "status", "created_at"]
REQUEST_HEADERS = ["id", "from_email", "target_name", "target_role", "project", "team_name", "status", "created_at"]

DEFAULT_PROFILE = {
    "id": "me",
    "name": "Alex Tan",
    "email": "alex.tan@linkup.demo",
    "role": "Frontend Developer",
    "experience": "1-2 years",
    "skills": "React;Python;UI/UX",
    "interests": "AI startups;Hackathons;EdTech",
    "project_types": "AI Product",
    "preferred_roles": "Backend Engineer;Machine Learning Engineer",
    "availability": "Weekday evenings;Weekend mornings",
    "working_style": "Fast responder;Collaborative member",
    "communication_style": "Frequent updates;Friendly tone",
    "goals": "Build MVPs;Join innovation challenges",
    "portfolio": "Campus AI Assistant;Course Planner UI;Hackathon Landing Page",
    "badges": "First Collaboration;Active Contributor",
}


def ensure_csv_exists():
    if not CSV_PATH.exists():
        with CSV_PATH.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=HEADERS)
            writer.writeheader()


def ensure_file(path, headers):
    if not path.exists():
        with path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=headers)
            writer.writeheader()


def read_csv(path, headers):
    ensure_file(path, headers)
    with path.open("r", newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def write_csv(path, headers, rows):
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in headers})


def read_profile():
    rows = read_csv(PROFILE_PATH, HEADERS)
    return rows[0] if rows else DEFAULT_PROFILE.copy()


def write_profile(profile):
    clean = {key: profile.get(key, DEFAULT_PROFILE.get(key, "")) for key in HEADERS}
    clean["id"] = clean.get("id") or "me"
    write_csv(PROFILE_PATH, HEADERS, [clean])
    return clean


def read_users():
    ensure_csv_exists()
    with CSV_PATH.open("r", newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def write_users(users):
    with CSV_PATH.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=HEADERS)
        writer.writeheader()
        for user in users:
            writer.writerow({key: user.get(key, "") for key in HEADERS})


def split_values(value):
    return [item.strip() for item in str(value or "").split(";") if item.strip()]


def lower_values(value):
    return {item.lower() for item in split_values(value)}


ROLE_ALIASES = {
    "ml engineer": "machine learning engineer",
    "machine learning engineer": "machine learning engineer",
    "data processing engineer": "data processing engineer",
    "data engineer": "data processing engineer",
    "frontend engineer": "frontend developer",
    "frontend developer": "frontend developer",
    "backend developer": "backend engineer",
    "backend engineer": "backend engineer",
    "ui designer": "ui/ux designer",
    "ux designer": "ui/ux designer",
    "ui/ux designer": "ui/ux designer",
    "cloud engineer": "cloud engineer",
    "mobile developer": "mobile developer",
    "product designer": "product designer",
    "product manager": "product manager",
    "full stack developer": "full stack developer",
    "full-stack developer": "full stack developer",
    "devops engineer": "devops engineer",
    "dev ops engineer": "devops engineer",
    "data analyst": "data analyst",
    "cybersecurity analyst": "cybersecurity analyst",
    "security analyst": "cybersecurity analyst",
    "qa tester": "qa tester",
    "quality assurance tester": "qa tester",
    "business analyst": "business analyst",
    "ar/vr developer": "ar/vr developer",
    "vr developer": "ar/vr developer",
    "ai prompt engineer": "ai prompt engineer",
    "prompt engineer": "ai prompt engineer",
    "content strategist": "content strategist",
    "pitch presenter": "pitch presenter",
}


def normalize_role(value):
    role = str(value or "").strip().lower()
    return ROLE_ALIASES.get(role, role)


def overlap(left, right):
    return sorted(lower_values(left).intersection(lower_values(right)))


def role_matches_target(target_roles, candidate):
    targets = [normalize_role(role) for role in split_values(target_roles)]
    candidate_roles = [normalize_role(candidate.get("role", ""))]
    return bool(targets and any(target == candidate_role for target in targets for candidate_role in candidate_roles))


def role_overlap_labels(left, right):
    right_by_normalized = {normalize_role(role): role for role in split_values(right)}
    matches = []
    for role in split_values(left):
        normalized = normalize_role(role)
        if normalized in right_by_normalized:
            matches.append(right_by_normalized[normalized])
    return matches


def text_token_overlap(left, right):
    left_tokens = {
        token.strip(".,:/()[]").lower()
        for item in split_values(left)
        for token in item.replace("-", " ").split()
        if len(token.strip(".,:/()[]")) > 2
    }
    right_tokens = {
        token.strip(".,:/()[]").lower()
        for token in str(right or "").replace("-", " ").replace(";", " ").split()
        if len(token.strip(".,:/()[]")) > 2
    }
    return sorted(left_tokens.intersection(right_tokens))


def save_profile(profile):
    profile = write_profile(profile)
    users = read_users()
    clean = {key: profile.get(key, "") for key in HEADERS}
    clean["id"] = profile.get("id") or f"u{int(time.time())}"
    found = None
    for index, user in enumerate(users):
        if user.get("email", "").lower() == clean.get("email", "").lower():
            found = index
            break
    if found is None:
        users.append(clean)
    else:
        users[found] = {**users[found], **clean}
    write_users(users)
    return clean, users


def get_my_teams(owner_email=None):
    owner = (owner_email or read_profile().get("email", "")).lower()
    return [team for team in read_csv(TEAMS_PATH, TEAM_HEADERS) if team.get("owner_email", "").lower() == owner]


def save_team(data):
    profile = read_profile()
    teams = read_csv(TEAMS_PATH, TEAM_HEADERS)
    team = {
        "id": data.get("id") or f"team{int(time.time())}",
        "owner_email": profile.get("email", ""),
        "team_name": data.get("team_name", "Untitled Team"),
        "idea": data.get("idea", ""),
        "project_type": data.get("project_type", "AI Product"),
        "team_size": data.get("team_size") or data.get("size") or "5",
        "open_roles": data.get("open_roles", ""),
        "status": "Recruiting",
        "created_at": time.strftime("%Y-%m-%d %H:%M"),
    }
    existing = next((i for i, item in enumerate(teams) if item.get("id") == team["id"]), None)
    if existing is None:
        teams.append(team)
    else:
        teams[existing] = team
    write_csv(TEAMS_PATH, TEAM_HEADERS, teams)
    return team, get_my_teams(profile.get("email"))


def save_request(data):
    profile = read_profile()
    requests = read_csv(REQUESTS_PATH, REQUEST_HEADERS)
    request = {
        "id": data.get("id") or f"req{int(time.time())}",
        "from_email": profile.get("email", ""),
        "target_name": data.get("target_name", ""),
        "target_role": data.get("target_role", ""),
        "project": data.get("project", "AI Product Collaboration"),
        "team_name": data.get("team_name", ""),
        "status": "In Progress",
        "created_at": time.strftime("%Y-%m-%d %H:%M"),
    }
    requests.append(request)
    write_csv(REQUESTS_PATH, REQUEST_HEADERS, requests)
    return request, [item for item in requests if item.get("from_email", "").lower() == profile.get("email", "").lower()]


def score_candidate(profile, candidate):
    target_roles = profile.get("target_roles") or profile.get("preferred_roles")
    target_skills = profile.get("target_skills") or profile.get("skills")
    target_interests = profile.get("target_interests") or profile.get("interests")
    target_project = profile.get("target_project_type") or profile.get("project_types")
    priority = profile.get("search_priority", "role_first")

    skill = overlap(target_skills, candidate.get("skills"))
    interest = overlap(target_interests, candidate.get("interests"))
    project = overlap(target_project, candidate.get("project_types"))
    availability = overlap(profile.get("availability"), candidate.get("availability"))
    communication = overlap(profile.get("communication_style"), candidate.get("communication_style"))
    working = overlap(profile.get("working_style"), candidate.get("working_style"))

    role_fit = role_matches_target(target_roles, candidate)

    score = 24
    score += 36 if role_fit else -18
    score += min(len(skill) * (14 if priority == "skill_first" else 11), 34)
    score += min(len(project) * 8, 12)
    score += min(len(interest) * 5, 12)
    score += min(len(availability) * 4, 8)
    score += min((len(communication) + len(working)) * 3, 8)
    score = max(42, min(score, 98))

    reasons = []
    if skill:
        reasons.append(f"matches requested teammate skills ({', '.join(skill)})")
    if interest:
        reasons.append(f"similar interests ({', '.join(interest)})")
    if project:
        reasons.append(f"same project type ({', '.join(project)})")
    if role_fit:
        reasons.append(f"high-priority role fit for {candidate.get('role')}")
    elif target_roles:
        reasons.append(f"lower role fit because the displayed role is {candidate.get('role')}, not {target_roles}")
    if availability:
        reasons.append(f"overlapping availability ({', '.join(availability)})")
    if communication or working:
        reasons.append("profile-based working or communication compatibility")
    if not reasons:
        reasons.append("general profile compatibility")

    return {
        **candidate,
        "score": score,
        "explanation": "Recommended because of " + "; ".join(reasons) + ".",
    }


def fallback_match(profile, mode):
    if mode == "team":
        teams = get_teams()
        scored_teams = [score_team(profile, team) for team in teams]
        scored_teams.sort(key=lambda item: item["score"], reverse=True)
        return scored_teams[:5]
    users = [
        user for user in read_users()
        if user.get("email", "").lower() != profile.get("email", "").lower()
    ]
    target_roles = profile.get("target_roles") or profile.get("preferred_roles")
    role_filtered = [user for user in users if role_matches_target(target_roles, user)]
    if role_filtered:
        users = role_filtered
    scored = [score_candidate(profile, user) for user in users]
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:5]


def score_team(profile, team):
    role_overlap = role_overlap_labels(profile.get("target_roles") or profile.get("preferred_roles"), team.get("open_roles"))
    project_overlap = overlap(profile.get("target_project_type") or profile.get("project_types"), team.get("project_type"))
    interest_overlap = overlap(profile.get("target_interests") or profile.get("interests"), team.get("idea"))
    goal_overlap = text_token_overlap(profile.get("target_goals") or profile.get("target_interests") or profile.get("interests"), team.get("idea"))
    stage_overlap = text_token_overlap(profile.get("target_stage"), team.get("idea") + " " + team.get("status", ""))
    score = 40 + min(len(role_overlap) * 24, 36) + min(len(project_overlap) * 18, 18) + min(len(interest_overlap) * 8, 14) + min(len(goal_overlap) * 5, 12) + min(len(stage_overlap) * 4, 8)
    score = min(score, 96)
    reasons = []
    if role_overlap:
        reasons.append(f"your preferred role matches open roles ({', '.join(role_overlap)})")
    if project_overlap:
        reasons.append(f"same project type ({', '.join(project_overlap)})")
    if goal_overlap:
        reasons.append(f"team idea matches your target goals ({', '.join(goal_overlap[:4])})")
    if not reasons:
        reasons.append("the team is actively recruiting and fits your collaboration direction")
    return {
        **team,
        "score": score,
        "skills": team.get("open_roles", ""),
        "availability": team.get("status", "Recruiting"),
        "explanation": "Recommended because " + "; ".join(reasons) + ".",
    }


def gemini_match(profile, candidates, mode):
    global LAST_GEMINI_ERROR, LAST_GEMINI_MODEL_USED
    LAST_GEMINI_ERROR = ""
    if not GEMINI_KEY:
        LAST_GEMINI_ERROR = "GEMINI_API_KEY is not configured."
        return None

    if mode == "team":
        prepared_candidates = sorted([score_team(profile, c) for c in candidates], key=lambda item: item["score"], reverse=True)
    else:
        target_roles = profile.get("target_roles") or profile.get("preferred_roles")
        role_filtered = [c for c in candidates if role_matches_target(target_roles, c)]
        source_candidates = role_filtered if role_filtered else candidates
        prepared_candidates = sorted([score_candidate(profile, c) for c in source_candidates], key=lambda item: item["score"], reverse=True)

    compact_candidates = [
        {
            "name": c.get("name") or c.get("team_name"),
            "role": c.get("role") or c.get("open_roles"),
            "skills": c.get("skills") or c.get("open_roles"),
            "interests": c.get("interests") or c.get("idea"),
            "availability": c.get("availability"),
            "working_style": c.get("working_style"),
            "communication_style": c.get("communication_style"),
        }
        for c in prepared_candidates[:6]
    ]
    prompt = {
        "task": "Rank the best Link-Up collaborators for a user. Return strict JSON only.",
        "mode": mode,
        "matching_standard": {
            "highest_priority": "The user's current search intent: target_roles and target_skills. A candidate matching the requested teammate role should rank higher than a candidate who only shares profile interests.",
            "medium_priority": "Target project type and target project direction.",
            "lower_priority": "Profile context such as user's own availability, interests, working style and communication style. Use these as tie-breakers and compatibility support, not as the main ranking factor.",
            "explanation_rule": "Explain the recommendation by clearly separating requested teammate fit from profile-based compatibility."
        },
        "user_profile": profile,
        "hard_requirement": f"Target role(s) selected by user: {profile.get('target_roles') or profile.get('preferred_roles')}. Do not describe another role as the target role unless it exactly matches one selected target role.",
        "candidates": compact_candidates,
        "json_schema": {
            "matches": [
                {
                    "name": "candidate name",
                    "score": 0,
                    "explanation": "short explainable AI reason"
                }
            ]
        },
    }
    body = json.dumps({
        "contents": [{"parts": [{"text": json.dumps(prompt)}]}],
        "generationConfig": {"temperature": 0.25, "response_mime_type": "application/json"},
    }).encode("utf-8")
    errors = []
    for model in GEMINI_MODEL_FALLBACKS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
        request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                raw = json.loads(response.read().decode("utf-8"))
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            ranked = json.loads(text).get("matches", [])
            by_name = {
                (candidate.get("name") or candidate.get("team_name")): (
                    score_team(profile, candidate) if candidate.get("team_name") else score_candidate(profile, candidate)
                )
                for candidate in prepared_candidates
            }
            output = []
            for item in ranked:
                base = by_name.get(item.get("name"))
                if base:
                    gemini_score = int(item.get("score", base["score"]))
                    base["score"] = max(base["score"], min(gemini_score, 98))
                    base["explanation"] = item.get("explanation", base["explanation"])
                    output.append(base)
            if output:
                target_roles = profile.get("target_roles") or profile.get("preferred_roles")
                if mode != "team" and target_roles:
                    role_exact = [item for item in output if role_matches_target(target_roles, item)]
                    if role_exact:
                        output = role_exact
                output.sort(key=lambda item: item["score"], reverse=True)
                LAST_GEMINI_MODEL_USED = model
                return output[:5]
            errors.append(f"{model}: empty Gemini response")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="ignore")
            errors.append(f"{model}: HTTP {error.code} {detail[:180]}")
            continue
        except (urllib.error.URLError, KeyError, ValueError, TimeoutError) as error:
            errors.append(f"{model}: {error}")
            continue
    LAST_GEMINI_ERROR = " | ".join(errors[-3:]) if errors else "Gemini request failed."
    return None


def get_teams():
    return [
        {
            "team_name": "AI Campus Builders",
            "idea": "Build an AI assistant for student collaboration and study team planning.",
            "project_type": "AI Product",
            "open_roles": "ML Engineer;Backend Engineer;UI/UX Designer",
            "status": "Recruiting",
        },
        {
            "team_name": "GreenHack Sprint",
            "idea": "Prototype a sustainability app for campus waste reporting.",
            "project_type": "Competition",
            "open_roles": "Frontend Developer;Data Processing Engineer;Pitch Presenter",
            "status": "Recruiting",
        },
        {
            "team_name": "ResearchFlow Lab",
            "idea": "Create a lightweight research collaboration dashboard.",
            "project_type": "Research Project",
            "open_roles": "Backend Engineer;Product Designer",
            "status": "Recruiting",
        },
        {
            "team_name": "DataBridge Studio",
            "idea": "Build a data processing pipeline and analytics dashboard for competition submissions.",
            "project_type": "AI Product",
            "open_roles": "Data Processing Engineer;Backend Engineer;Cloud Engineer",
            "status": "Prototype building",
        },
        {
            "team_name": "UX Launch Crew",
            "idea": "Design and test a polished product prototype for a student startup MVP.",
            "project_type": "Startup",
            "open_roles": "UI/UX Designer;Product Designer;Frontend Developer",
            "status": "Idea validation",
        },
        {
            "team_name": "Mobile Sprint Lab",
            "idea": "Create a mobile app for smart campus services with API integration.",
            "project_type": "Mobile App",
            "open_roles": "Mobile Developer;Backend Engineer;UI/UX Designer",
            "status": "MVP development",
        },
        {
            "team_name": "Open Source Mentors",
            "idea": "Coordinate an open source learning platform and contributor onboarding workflow.",
            "project_type": "Web App",
            "open_roles": "Frontend Developer;Backend Engineer;Product Designer",
            "status": "Prototype building",
        },
        {
            "team_name": "PitchReady Founders",
            "idea": "Prepare a startup pitch, demo video and business validation plan.",
            "project_type": "Startup",
            "open_roles": "Pitch Presenter;Product Designer;Data Processing Engineer",
            "status": "Pitch preparation",
        },
        {
            "team_name": "SecureCampus Lab",
            "idea": "Build a cybersecurity reporting tool for smart campus safety and incident tracking.",
            "project_type": "Cybersecurity Tool",
            "open_roles": "Cybersecurity Analyst;Backend Engineer;QA Tester",
            "status": "Prototype building",
        },
        {
            "team_name": "VR Collaboration Room",
            "idea": "Prototype a virtual reality meeting space for remote student project teams.",
            "project_type": "VR Experience",
            "open_roles": "AR/VR Developer;UI/UX Designer;Full Stack Developer",
            "status": "MVP development",
        },
        {
            "team_name": "InsightOps Data Team",
            "idea": "Create an analytics platform for collaboration outcomes, badges and team success patterns.",
            "project_type": "Data Platform",
            "open_roles": "Data Analyst;Data Processing Engineer;Cloud Engineer",
            "status": "Testing and QA",
        },
        {
            "team_name": "PromptFlow Builders",
            "idea": "Design prompt workflows and evaluation tools for explainable AI teammate recommendations.",
            "project_type": "AI Product",
            "open_roles": "AI Prompt Engineer;Machine Learning Engineer;Product Manager",
            "status": "User research",
        },
        {
            "team_name": "LaunchMarket Crew",
            "idea": "Validate a startup idea with user interviews, pitch materials and market research.",
            "project_type": "Startup",
            "open_roles": "Business Analyst;Content Strategist;Pitch Presenter",
            "status": "Idea validation",
        },
    ]


def get_competitions():
    return [
        {
            "title": "AI Innovation Challenge",
            "theme": "AI for student productivity",
            "introduction": "Teams design a functional AI concept that solves a real student problem.",
            "requirements": "3-5 members, prototype demo, short report, and 5-minute presentation.",
            "reward": "RM 3,000 + Innovation Badge",
            "teams": ["AI Campus Builders", "StudySync Lab"],
        },
        {
            "title": "Smart Campus Hackathon",
            "theme": "Connected campus services",
            "introduction": "Build a digital service that improves campus life, safety, or collaboration.",
            "requirements": "2-6 members, working prototype, poster, and pitch deck.",
            "reward": "RM 2,000 + Hackathon Champion Badge",
            "teams": ["GreenHack Sprint", "Campus Linkers"],
        },
        {
            "title": "Startup Weekend",
            "theme": "From idea to MVP",
            "introduction": "Create a startup concept and validate it with users in one weekend.",
            "requirements": "4-6 members, MVP mockup, business model, and demo video.",
            "reward": "Mentorship + Startup Founder Badge",
            "teams": ["Founders Lab", "MarketFit Crew"],
        },
    ]


def get_conversations():
    return [
        {
            "title": "AI Campus Builders",
            "type": "Team Chat",
            "last": "Sprint planning starts tonight.",
            "messages": [
                {"from": "System", "text": "Team created. Group chat unlocked for accepted collaborators."},
                {"from": "Sarah", "text": "I can handle backend APIs and auth."},
                {"from": "You", "text": "Great. I will prepare the product flow and UI prototype."},
            ],
        },
        {
            "title": "Sarah Chen",
            "type": "Collaboration Chat",
            "last": "Want to plan a first sprint?",
            "messages": [
                {"from": "System", "text": "Your collaboration request has been accepted."},
                {"from": "Sarah", "text": "I like your AI startup idea. Want to define roles first?"},
                {"from": "You", "text": "Yes, let's start with frontend, backend and ML responsibilities."},
            ],
        },
        {
            "title": "Michael Lee",
            "type": "Locked",
            "last": "Chat unlocks after both sides agree.",
            "messages": [
                {"from": "System", "text": "This chat is locked until the collaboration request is accepted."}
            ],
        },
    ]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def json_response(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length).decode("utf-8") or "{}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            self.path = "/Link-up AI matching.html"
            return super().do_GET()
        if path == "/api/data":
            profile = read_profile()
            return self.json_response(200, {
                "profile": profile,
                "users": read_users(),
                "teams": get_teams(),
                "my_teams": get_my_teams(profile.get("email")),
                "requests": [item for item in read_csv(REQUESTS_PATH, REQUEST_HEADERS) if item.get("from_email", "").lower() == profile.get("email", "").lower()],
                "competitions": get_competitions(),
                "conversations": get_conversations(),
                "ai_provider": "gemini" if GEMINI_KEY else "fallback",
                "gemini_model": ", ".join(GEMINI_MODEL_FALLBACKS),
                "key_source": "environment" if os.environ.get("GEMINI_API_KEY", "").strip() else ("gemini_api_key.txt" if GEMINI_KEY else "none"),
            })
        if path == "/api/settings":
            return self.json_response(200, {
                "gemini_configured": bool(GEMINI_KEY),
                "gemini_model": ", ".join(GEMINI_MODEL_FALLBACKS),
                "key_source": "environment" if os.environ.get("GEMINI_API_KEY", "").strip() else ("gemini_api_key.txt" if GEMINI_KEY else "none"),
            })
        if path == "/api/users":
            return self.json_response(200, {"users": read_users()})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/match":
            match_request = self.read_json()
            saved_profile, users = save_profile(match_request)
            profile = {**saved_profile, **match_request}
            mode = profile.get("mode", "individual")
            if mode == "recruit" and not profile.get("team_id"):
                my_teams = get_my_teams(profile.get("email"))
                if not my_teams:
                    return self.json_response(400, {
                        "error": "Create a team before using Recruit Teammates for My Team.",
                        "required_action": "create_team",
                        "my_teams": [],
                    })
                return self.json_response(400, {
                    "error": "Select which team you want to recruit for first.",
                    "required_action": "select_team",
                    "my_teams": my_teams,
                })
            if mode == "recruit" and profile.get("team_id"):
                team = next((item for item in get_my_teams(profile.get("email")) if item.get("id") == profile.get("team_id")), None)
                if team:
                    profile["preferred_roles"] = team.get("open_roles", profile.get("preferred_roles", ""))
                    profile["project_types"] = team.get("project_type", profile.get("project_types", ""))
            candidates = [user for user in users if user.get("email", "").lower() != profile.get("email", "").lower()]
            gemini_candidates = get_teams() if mode == "team" else candidates
            gemini = gemini_match(profile, gemini_candidates, mode)
            if gemini:
                return self.json_response(200, {"provider": "gemini", "model": LAST_GEMINI_MODEL_USED, "matches": gemini})
            return self.json_response(200, {
                "provider": "fallback",
                "model": "Local explainable scoring fallback",
                "gemini_error": LAST_GEMINI_ERROR,
                "matches": fallback_match(profile, mode),
            })
        if path == "/api/profile":
            profile = self.read_json()
            profile, users = save_profile(profile)
            return self.json_response(200, {"saved": True, "profile": profile, "users": len(users)})
        if path == "/api/teams":
            team, teams = save_team(self.read_json())
            return self.json_response(200, {"saved": True, "team": team, "my_teams": teams})
        if path == "/api/requests":
            request, requests = save_request(self.read_json())
            return self.json_response(200, {"saved": True, "request": request, "requests": requests})
        if path == "/api/settings":
            global GEMINI_KEY
            data = self.read_json()
            key = data.get("gemini_api_key", "").strip()
            if not key:
                return self.json_response(400, {"saved": False, "error": "Gemini API key is empty."})
            KEY_PATH.write_text(key, encoding="utf-8")
            GEMINI_KEY = key
            return self.json_response(200, {"saved": True, "gemini_configured": True, "key_source": "gemini_api_key.txt"})
        return self.json_response(404, {"error": "Endpoint not found"})


if __name__ == "__main__":
    ensure_csv_exists()
    print(f"Link-Up AI Matching is running at http://127.0.0.1:{PORT}")
    print(f"CSV storage file: {CSV_PATH}")
    print("Gemini API:", "enabled" if GEMINI_KEY else "not configured, using fallback AI")
    print("Gemini model order:", ", ".join(GEMINI_MODEL_FALLBACKS))
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
