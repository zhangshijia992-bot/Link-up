from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from pathlib import Path
import csv
import base64
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import time
import urllib.error
import urllib.request
import smtplib
import ssl
from email.message import EmailMessage

try:
    from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
    from azure.storage.blob import BlobServiceClient, ContentSettings
except Exception as azure_import_error:
    ResourceExistsError = None
    ResourceNotFoundError = None
    BlobServiceClient = None
    ContentSettings = None
    AZURE_IMPORT_ERROR = str(azure_import_error)
else:
    AZURE_IMPORT_ERROR = ""


ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT") or os.environ.get("WEBSITES_PORT") or os.environ.get("LINKUP_PORT", "4173"))
HOST = os.environ.get("HOST") or ("0.0.0.0" if (os.environ.get("PORT") or os.environ.get("WEBSITES_PORT")) else "127.0.0.1")
IS_CLOUD_DEPLOYMENT = bool(
    os.environ.get("PORT")
    or os.environ.get("WEBSITES_PORT")
    or os.environ.get("WEBSITE_SITE_NAME")
    or os.environ.get("RENDER")
    or os.environ.get("RAILWAY_ENVIRONMENT")
)
def resolve_data_root():
    configured = os.environ.get("LINKUP_DATA_DIR", "").strip()
    if configured:
        return Path(configured)
    if IS_CLOUD_DEPLOYMENT:
        home_dir = os.environ.get("HOME") or os.environ.get("HOME_EXPANDED")
        if home_dir:
            return Path(home_dir) / "linkup-data"
        azure_windows_home = Path("D:/home")
        if azure_windows_home.exists():
            return azure_windows_home / "linkup-data"
    return ROOT


DATA_ROOT = resolve_data_root()
DATA_ROOT.mkdir(parents=True, exist_ok=True)
CSV_PATH = DATA_ROOT / "users.csv"
PROFILE_PATH = DATA_ROOT / "profile.csv"
TEAMS_PATH = DATA_ROOT / "teams.csv"
REQUESTS_PATH = DATA_ROOT / "requests.csv"
ACCOUNTS_PATH = DATA_ROOT / "accounts.csv"
MESSAGES_PATH = DATA_ROOT / "messages.csv"
COMPETITION_ENTRIES_PATH = DATA_ROOT / "competition_entries.csv"
UPLOAD_DIR = DATA_ROOT / "uploads"
KEY_PATH = ROOT / "gemini_api_key.txt"
AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_STORAGE_CONTAINER = os.environ.get("LINKUP_STORAGE_CONTAINER", "linkup-data").strip() or "linkup-data"
USE_AZURE_BLOB_STORAGE = bool(AZURE_STORAGE_CONNECTION_STRING)
BLOB_CONTAINER_CLIENT = None
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
ALLOW_RUNTIME_KEY_SAVE = (
    os.environ.get("LINKUP_ALLOW_RUNTIME_KEY_SAVE", "").strip().lower() in {"1", "true", "yes"}
    or not IS_CLOUD_DEPLOYMENT
)


def load_gemini_key():
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_key:
        return env_key
    if KEY_PATH.exists():
        return KEY_PATH.read_text(encoding="utf-8").strip()
    return ""


GEMINI_KEY = load_gemini_key()
EMAIL_PROVIDER = os.environ.get("LINKUP_EMAIL_PROVIDER", "").strip().lower()
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_FROM = os.environ.get("LINKUP_EMAIL_FROM", os.environ.get("RESEND_FROM", "")).strip()
SMTP_HOST = os.environ.get("LINKUP_SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("LINKUP_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("LINKUP_SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("LINKUP_SMTP_PASSWORD", "").strip()
SMTP_FROM = os.environ.get("LINKUP_SMTP_FROM", SMTP_USER).strip()

HEADERS = [
    "id", "name", "email", "role", "experience", "skills", "interests",
    "project_types", "preferred_roles", "availability", "working_style",
    "communication_style", "goals", "bio", "portfolio", "badges", "institution",
    "organisation_type", "company", "location", "study_level", "major",
    "graduation_year", "verification_status", "reliability_score"
]

TEAM_HEADERS = ["id", "owner_email", "team_name", "idea", "project_type", "team_size", "open_roles", "role_counts", "status", "created_at"]
REQUEST_HEADERS = ["id", "from_email", "target_email", "target_name", "target_role", "request_type", "project", "team_name", "status", "created_at", "updated_at"]
ACCOUNT_HEADERS = ["email", "password_hash", "salt", "created_at"]
MESSAGE_HEADERS = ["id", "request_id", "sender_email", "sender_name", "message_type", "body", "file_name", "file_kind", "file_url", "created_at"]
COMPETITION_ENTRY_HEADERS = ["id", "competition_title", "team_id", "team_name", "owner_email", "status", "created_at"]
SESSIONS = {}
PENDING_OTPS = {}
CALL_SIGNALS = []
OTP_COOLDOWN_SECONDS = 60

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
    "bio": "Computer Science student interested in AI products, hackathons, and practical MVP building.",
    "portfolio": "Campus AI Assistant;Course Planner UI;Hackathon Landing Page",
    "badges": "First Collaboration;Active Contributor",
    "institution": "Asia Pacific University of Technology & Innovation (APU)",
    "organisation_type": "University Student",
    "company": "",
    "location": "Kuala Lumpur",
    "study_level": "Bachelor Degree",
    "major": "Computer Science",
    "graduation_year": "2027",
    "verification_status": "OTP verified",
    "reliability_score": "86",
}


def ensure_csv_exists():
    ensure_file(CSV_PATH, HEADERS)


def active_storage_provider():
    if USE_AZURE_BLOB_STORAGE and BlobServiceClient:
        return "azure_blob"
    if USE_AZURE_BLOB_STORAGE and not BlobServiceClient:
        return "azure_blob_missing_sdk"
    return "local_file"


def blob_name_for(path):
    if isinstance(path, Path):
        if path.parent == UPLOAD_DIR:
            return f"uploads/{path.name}"
        return path.name
    return str(path).replace("\\", "/").lstrip("/")


def get_blob_container():
    global BLOB_CONTAINER_CLIENT
    if not USE_AZURE_BLOB_STORAGE:
        return None
    if not BlobServiceClient:
        raise RuntimeError(f"Azure Blob SDK is not installed: {AZURE_IMPORT_ERROR}")
    if BLOB_CONTAINER_CLIENT is None:
        service = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
        container = service.get_container_client(AZURE_STORAGE_CONTAINER)
        try:
            container.create_container()
        except Exception as error:
            if ResourceExistsError is None or not isinstance(error, ResourceExistsError):
                raise
        BLOB_CONTAINER_CLIENT = container
    return BLOB_CONTAINER_CLIENT


def blob_exists(path):
    if active_storage_provider() != "azure_blob":
        return False
    try:
        return get_blob_container().get_blob_client(blob_name_for(path)).exists()
    except Exception as error:
        print("AZURE BLOB EXISTS ERROR:", repr(error), flush=True)
        raise


def read_blob_text(path):
    blob = get_blob_container().get_blob_client(blob_name_for(path))
    return blob.download_blob().readall().decode("utf-8-sig")


def write_blob_text(path, text):
    blob = get_blob_container().get_blob_client(blob_name_for(path))
    blob.upload_blob(text.encode("utf-8"), overwrite=True)


def read_blob_bytes(path):
    blob = get_blob_container().get_blob_client(blob_name_for(path))
    properties = blob.get_blob_properties()
    return blob.download_blob().readall(), properties.content_settings.content_type


def write_blob_bytes(path, raw, content_type="application/octet-stream"):
    blob = get_blob_container().get_blob_client(blob_name_for(path))
    settings = ContentSettings(content_type=content_type) if ContentSettings else None
    blob.upload_blob(raw, overwrite=True, content_settings=settings)


def ensure_file(path, headers):
    if active_storage_provider() == "azure_blob":
        if blob_exists(path):
            return
        for seed_path in [path, ROOT / path.name]:
            if seed_path.exists():
                write_blob_text(path, seed_path.read_text(encoding="utf-8-sig"))
                print(f"Migrated existing {path.name} into Azure Blob Storage.", flush=True)
                return
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=headers)
        writer.writeheader()
        write_blob_text(path, buffer.getvalue())
        return

    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        seed_path = ROOT / path.name
        if path.parent != ROOT and seed_path.exists():
            path.write_text(seed_path.read_text(encoding="utf-8-sig"), encoding="utf-8")
            return
        with path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=headers)
            writer.writeheader()


def read_csv(path, headers):
    ensure_file(path, headers)
    if active_storage_provider() == "azure_blob":
        text = read_blob_text(path)
        return list(csv.DictReader(io.StringIO(text)))
    with path.open("r", newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def write_csv(path, headers, rows):
    if active_storage_provider() == "azure_blob":
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in headers})
        write_blob_text(path, buffer.getvalue())
        return

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in headers})


def profile_for_email(email=""):
    normalized_email = (email or "").strip().lower()
    users = read_users()
    if normalized_email:
        existing = next((user for user in users if user.get("email", "").lower() == normalized_email), None)
        if existing:
            return existing
    rows = read_csv(PROFILE_PATH, HEADERS)
    profile = rows[0] if rows else DEFAULT_PROFILE.copy()
    if normalized_email:
        profile = {**profile, "email": normalized_email, "id": normalized_email}
    return profile


def read_profile(email=""):
    return profile_for_email(email)


def write_profile(profile):
    clean = {key: profile.get(key, DEFAULT_PROFILE.get(key, "")) for key in HEADERS}
    clean["id"] = clean.get("id") or "me"
    write_csv(PROFILE_PATH, HEADERS, [clean])
    return clean


def password_digest(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000).hex()


def read_accounts():
    return read_csv(ACCOUNTS_PATH, ACCOUNT_HEADERS)


def build_otp_message(otp, purpose="verification"):
    subject = "Your Link-Up 2.0 verification code"
    body = f"""Hello,

Your Link-Up 2.0 {purpose} code is:

{otp}

This OTP will expire in 10 minutes.

If you did not request this code, please ignore this email.

Link-Up 2.0
AI Team Formation Workspace
"""
    return subject, body


def send_resend_email(to_email, subject, body):
    if not RESEND_API_KEY or not RESEND_FROM:
        return "Resend email provider is not configured. Please set RESEND_API_KEY and LINKUP_EMAIL_FROM."
    payload = {
        "from": RESEND_FROM,
        "to": [to_email],
        "subject": subject,
        "text": body,
    }
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status in {200, 201, 202}:
                print("OTP EMAIL SENT BY RESEND", flush=True)
                return ""
            detail = response.read().decode("utf-8", errors="replace")
            return f"Resend email failed with HTTP {response.status}: {detail}"
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print("RESEND EMAIL ERROR:", error.code, detail[:300], flush=True)
        return f"Resend email failed with HTTP {error.code}: {detail}"
    except Exception as error:
        print("RESEND EMAIL ERROR:", repr(error), flush=True)
        return f"Resend email failed: {error}"


def send_smtp_email(to_email, subject, body):
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        return "SMTP email provider is not configured. Please set LINKUP_SMTP_HOST, LINKUP_SMTP_USER, and LINKUP_SMTP_PASSWORD."
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM or SMTP_USER
    message["To"] = to_email
    message.set_content(body)

    try:
        print("SMTP OTP SEND STARTED", flush=True)

        if SMTP_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15, context=context) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(message)

        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(message)

        print("OTP EMAIL SENT BY SMTP", flush=True)
        return ""

    except Exception as error:
        print("SMTP EMAIL ERROR:", repr(error), flush=True)
        return f"Failed to send OTP email: {error}"


def send_otp_email(to_email, otp, purpose="verification"):
    subject, body = build_otp_message(otp, purpose)
    provider = EMAIL_PROVIDER or ("resend" if RESEND_API_KEY else "smtp")
    print(f"SENDING OTP EMAIL USING {provider.upper()}", flush=True)

    if provider == "resend":
        error = send_resend_email(to_email, subject, body)
        if not error:
            return ""
        if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
            print("RESEND FAILED; TRYING SMTP FALLBACK", flush=True)
            return send_smtp_email(to_email, subject, body)
        if not IS_CLOUD_DEPLOYMENT:
            print("Email provider failed locally. Prototype will show OTP on screen.", flush=True)
            return ""
        return error

    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        return send_smtp_email(to_email, subject, body)

    if not IS_CLOUD_DEPLOYMENT:
        print("Email provider not configured. Local prototype will show OTP on screen.", flush=True)
        return ""

    return "Email OTP is not configured. Please set RESEND_API_KEY and LINKUP_EMAIL_FROM, or configure SMTP fallback."


def otp_cooldown_payload(email, purpose, now):
    existing = PENDING_OTPS.get(email)
    if not existing or existing.get("purpose") != purpose or existing.get("expires_at", 0) <= now:
        return None
    last_sent_at = existing.get("last_sent_at", 0)
    wait_seconds = int(OTP_COOLDOWN_SECONDS - (now - last_sent_at))
    if wait_seconds <= 0:
        return None
    return {
        "email": email,
        "sent": False,
        "cooldown_seconds": wait_seconds,
        "expires_in_minutes": max(1, int((existing.get("expires_at", now) - now) // 60)),
        "delivery": f"An OTP was already sent. Please wait {wait_seconds} seconds before requesting another one.",
    }


def request_registration_otp(data):
    email = data.get("email", "").strip().lower()

    if not email or "@" not in email:
        return None, "Please enter a valid email address before requesting OTP."

    if any(account.get("email", "").lower() == email for account in read_accounts()):
        return None, "This email is already registered. Please log in instead."

    now = time.time()
    cooldown = otp_cooldown_payload(email, "register", now)
    if cooldown:
        return cooldown, ""

    otp = f"{secrets.randbelow(900000) + 100000}"

    PENDING_OTPS[email] = {
        "otp": otp,
        "expires_at": now + 600,
        "attempts": 0,
        "purpose": "register",
        "last_sent_at": now,
    }

    email_error = send_otp_email(email, otp, "registration")
    if email_error:
        PENDING_OTPS.pop(email, None)
        return None, email_error

    payload = {
        "email": email,
        "sent": True,
        "expires_in_minutes": 10,
        "cooldown_seconds": OTP_COOLDOWN_SECONDS,
        "delivery": "OTP has been sent to your email." if (SMTP_HOST and SMTP_USER and SMTP_PASSWORD) else "Prototype OTP is shown on screen.",
    }
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        payload["otp_demo"] = otp
    return payload, ""


def verify_registration_otp(email, otp):
    email = (email or "").strip().lower()
    record = PENDING_OTPS.get(email)
    if not record:
        return False, "Please request an OTP first."
    if record.get("purpose") != "register":
        return False, "Please request a registration OTP first."
    if time.time() > record["expires_at"]:
        PENDING_OTPS.pop(email, None)
        return False, "OTP expired. Please request a new OTP."
    record["attempts"] += 1
    if record["attempts"] > 5:
        PENDING_OTPS.pop(email, None)
        return False, "Too many OTP attempts. Please request a new OTP."
    if not hmac.compare_digest(str(record["otp"]), str(otp or "").strip()):
        return False, "Incorrect OTP. Please check the six-digit code."
    PENDING_OTPS.pop(email, None)
    return True, ""


def validate_login_credentials(email, password):
    email = (email or "").strip().lower()
    account = next((item for item in read_accounts() if item.get("email", "").lower() == email), None)
    if not account:
        return None, "Account not found. Please register first."
    expected = password_digest(password or "", account.get("salt", ""))
    if not hmac.compare_digest(expected, account.get("password_hash", "")):
        return None, "Incorrect password."
    return account, ""


def request_login_otp(data):
    email = data.get("email", "").strip().lower()

    _, error = validate_login_credentials(email, data.get("password", ""))
    if error:
        return None, error

    now = time.time()
    cooldown = otp_cooldown_payload(email, "login", now)
    if cooldown:
        return cooldown, ""

    otp = f"{secrets.randbelow(900000) + 100000}"

    PENDING_OTPS[email] = {
        "otp": otp,
        "expires_at": now + 600,
        "attempts": 0,
        "purpose": "login",
        "last_sent_at": now,
    }

    email_error = send_otp_email(email, otp, "login verification")
    if email_error:
        PENDING_OTPS.pop(email, None)
        return None, email_error

    payload = {
        "email": email,
        "sent": True,
        "expires_in_minutes": 10,
        "cooldown_seconds": OTP_COOLDOWN_SECONDS,
        "delivery": "OTP has been sent to your email." if (SMTP_HOST and SMTP_USER and SMTP_PASSWORD) else "Prototype OTP is shown on screen.",
    }
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        payload["otp_demo"] = otp
    return payload, ""


def verify_login_otp(data):
    email = data.get("email", "").strip().lower()
    _, error = validate_login_credentials(email, data.get("password", ""))
    if error:
        return None, error
    record = PENDING_OTPS.get(email)
    if not record or record.get("purpose") != "login":
        return None, "Please request a login OTP first."
    if time.time() > record["expires_at"]:
        PENDING_OTPS.pop(email, None)
        return None, "OTP expired. Please request a new OTP."
    record["attempts"] += 1
    if record["attempts"] > 5:
        PENDING_OTPS.pop(email, None)
        return None, "Too many OTP attempts. Please request a new OTP."
    if not hmac.compare_digest(str(record["otp"]), str(data.get("otp", "")).strip()):
        return None, "Incorrect OTP. Please check the six-digit code."
    PENDING_OTPS.pop(email, None)
    return {"email": email, "profile": read_profile(email), "token": create_session(email)}, ""


def create_session(email):
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = {"email": email.lower(), "created_at": time.time()}
    return token


def register_account(data):
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if not email or "@" not in email:
        return None, "Please enter a valid email address."
    if len(password) < 6:
        return None, "Password must be at least 6 characters."
    accounts = read_accounts()
    if any(account.get("email", "").lower() == email for account in accounts):
        return None, "This email is already registered. Please log in instead."
    otp_ok, otp_error = verify_registration_otp(email, data.get("otp", ""))
    if not otp_ok:
        return None, otp_error
    salt = secrets.token_hex(16)
    accounts.append({
        "email": email,
        "password_hash": password_digest(password, salt),
        "salt": salt,
        "created_at": time.strftime("%Y-%m-%d %H:%M"),
    })
    write_csv(ACCOUNTS_PATH, ACCOUNT_HEADERS, accounts)
    profile = {
        **DEFAULT_PROFILE,
        "id": email,
        "email": email,
        "name": data.get("name", "").strip() or email.split("@")[0].replace(".", " ").title(),
        "role": data.get("role", "Frontend Developer"),
        "skills": data.get("skills", DEFAULT_PROFILE["skills"]),
        "interests": data.get("interests", DEFAULT_PROFILE["interests"]),
        "availability": data.get("availability", DEFAULT_PROFILE["availability"]),
        "bio": data.get("bio", DEFAULT_PROFILE["bio"]),
        "institution": data.get("institution", DEFAULT_PROFILE["institution"]),
        "organisation_type": data.get("organisation_type", DEFAULT_PROFILE["organisation_type"]),
        "company": data.get("company", ""),
        "location": data.get("location", DEFAULT_PROFILE["location"]),
        "major": data.get("major", DEFAULT_PROFILE["major"]),
        "study_level": data.get("study_level", DEFAULT_PROFILE["study_level"]),
        "graduation_year": data.get("graduation_year", DEFAULT_PROFILE["graduation_year"]),
        "verification_status": "OTP verified",
        "reliability_score": "82",
    }
    save_profile(profile)
    return {"email": email, "profile": profile, "token": create_session(email)}, ""


def login_account(data):
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    _, error = validate_login_credentials(email, password)
    if error:
        return None, error
    return {"email": email, "profile": read_profile(email), "token": create_session(email)}, ""


def user_display_name_from_email(email):
    local_part = (email or "").split("@")[0].strip()
    if not local_part:
        return "Link-Up User"
    parts = re.split(r"[._\-]+", local_part)
    readable = " ".join(part.capitalize() for part in parts if part)
    return readable or local_part


def user_stub_from_account(account):
    email = account.get("email", "").strip().lower()
    return {
        **DEFAULT_PROFILE,
        "id": email,
        "email": email,
        "name": user_display_name_from_email(email),
        "verification_status": "OTP verified",
        "reliability_score": "80",
    }


def merge_user_records(*record_groups):
    merged = []
    by_key = {}
    for records in record_groups:
        for record in records:
            email = record.get("email", "").strip().lower()
            record_id = record.get("id", "").strip()
            key = email or record_id or record.get("name", "").strip().lower()
            if not key:
                continue
            clean = {header: str(record.get(header, "") or "").strip() for header in HEADERS}
            if email:
                clean["email"] = email
                clean["id"] = clean.get("id") or email
            if key not in by_key:
                by_key[key] = clean
                merged.append(clean)
                continue
            existing = by_key[key]
            for header, value in clean.items():
                if value:
                    existing[header] = value
    return merged


def apply_user_defaults(user, index=0):
    institutions = [
        "Asia Pacific University of Technology & Innovation (APU)",
        "Universiti Malaya (UM)",
        "Universiti Kebangsaan Malaysia (UKM)",
        "Universiti Putra Malaysia (UPM)",
        "Universiti Sains Malaysia (USM)",
        "Universiti Teknologi Malaysia (UTM)",
        "Taylor's University",
        "Monash University Malaysia",
        "Sunway University",
        "Multimedia University (MMU)",
    ]
    clean = {header: str(user.get(header, "") or "").strip() for header in HEADERS}
    clean["id"] = clean.get("id") or clean.get("email") or f"user-{index + 1}"
    clean["name"] = clean.get("name") or user_display_name_from_email(clean.get("email"))
    clean["institution"] = clean.get("institution") or institutions[index % len(institutions)]
    clean["organisation_type"] = clean.get("organisation_type") or "University Student"
    clean["company"] = clean.get("company") or ""
    clean["location"] = clean.get("location") or "Kuala Lumpur"
    clean["study_level"] = clean.get("study_level") or "Bachelor Degree"
    clean["major"] = clean.get("major") or "Computer Science"
    clean["graduation_year"] = clean.get("graduation_year") or "2027"
    clean["role"] = clean.get("role") or "Collaborator"
    clean["bio"] = clean.get("bio") or f"{clean.get('role', 'Collaborator')} interested in practical projects, team collaboration, and portfolio-building outcomes."
    clean["verification_status"] = clean.get("verification_status") or "Profile verified"
    clean["reliability_score"] = clean.get("reliability_score") or str(78 + (index % 18))
    return clean


def read_users():
    stored_users = read_csv(CSV_PATH, HEADERS)
    stored_profiles = [
        row for row in read_csv(PROFILE_PATH, HEADERS)
        if row.get("email", "").strip()
    ]
    account_users = [
        user_stub_from_account(account)
        for account in read_accounts()
        if account.get("email", "").strip()
    ]
    merged = merge_user_records(account_users, stored_users, stored_profiles)
    return [apply_user_defaults(user, index) for index, user in enumerate(merged)]


def write_users(users):
    write_csv(CSV_PATH, HEADERS, users)


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
    profile = {**DEFAULT_PROFILE, **profile}
    profile["email"] = profile.get("email", "").strip().lower()
    profile["id"] = profile.get("id") or profile["email"] or f"u{int(time.time())}"
    if not IS_CLOUD_DEPLOYMENT:
        write_profile(profile)
    users = read_users()
    clean = {key: profile.get(key, "") for key in HEADERS}
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
    return [normalize_team(team) for team in read_csv(TEAMS_PATH, TEAM_HEADERS) if team.get("owner_email", "").lower() == owner]


def normalize_team(team):
    clean = {key: team.get(key, "") for key in TEAM_HEADERS}
    if not clean.get("role_counts"):
        clean["role_counts"] = ";".join(f"{role}:1" for role in split_values(clean.get("open_roles")))
    if not clean.get("team_size"):
        clean["team_size"] = "5"
    return clean


def visible_requests_for(profile, requests=None):
    email = profile.get("email", "").lower()
    name = profile.get("name", "").strip().lower()
    rows = requests if requests is not None else read_csv(REQUESTS_PATH, REQUEST_HEADERS)
    visible = []
    for item in rows:
        from_email = item.get("from_email", "").lower()
        target_email = item.get("target_email", "").lower()
        target_name = item.get("target_name", "").strip().lower()
        if from_email == email or target_email == email or (name and target_name == name):
            visible.append(item)
    return visible


def accepted_request_for_actor(profile, request_id):
    for item in visible_requests_for(profile):
        if item.get("id") == request_id and item.get("status", "").lower() == "accepted":
            return item
    return None


def messages_for_visible_requests(profile):
    visible_ids = {item.get("id") for item in visible_requests_for(profile)}
    return [
        message
        for message in read_csv(MESSAGES_PATH, MESSAGE_HEADERS)
        if message.get("request_id") in visible_ids
    ]


def safe_upload_name(original_name):
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", original_name or "attachment")
    stem, dot, suffix = name.rpartition(".")
    if not stem:
        stem = name
        suffix = ""
    suffix = suffix[:12]
    return f"{stem[:42]}_{int(time.time() * 1000)}{dot}{suffix}" if suffix else f"{stem[:42]}_{int(time.time() * 1000)}"


def save_uploaded_file(data):
    file_data = data.get("file_data", "")
    file_name = data.get("file_name", "")
    if not file_data:
        return "", "", ""
    if "," in file_data:
        meta, encoded = file_data.split(",", 1)
        mime_match = re.search(r"data:([^;]+)", meta)
        mime_type = mime_match.group(1) if mime_match else data.get("file_kind", "")
    else:
        encoded = file_data
        mime_type = data.get("file_kind", "")
    raw = base64.b64decode(encoded)
    if len(raw) > 8 * 1024 * 1024:
        raise ValueError("Attachment is larger than 8 MB.")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if not Path(file_name).suffix and mime_type:
        file_name = f"{file_name or 'attachment'}{mimetypes.guess_extension(mime_type) or ''}"
    safe_name = safe_upload_name(file_name)
    target = UPLOAD_DIR / safe_name
    if active_storage_provider() == "azure_blob":
        write_blob_bytes(target, raw, mime_type or "application/octet-stream")
        return file_name or safe_name, mime_type, f"/uploads/{safe_name}"
    target.write_bytes(raw)
    return file_name or safe_name, mime_type, f"/uploads/{safe_name}"


def save_chat_message(data):
    profile = read_profile(data.get("sender_email", ""))
    request_id = data.get("request_id", "")
    if not accepted_request_for_actor(profile, request_id):
        return None, "Chat is locked until both sides accept the collaboration request."
    body = (data.get("body") or "").strip()
    message_type = data.get("message_type", "text")
    file_name = data.get("file_name", "")
    file_kind = data.get("file_kind", "")
    file_url = ""
    try:
        if data.get("file_data"):
            file_name, file_kind, file_url = save_uploaded_file(data)
            message_type = "image" if (file_kind or "").startswith("image/") else "file"
    except Exception as error:
        return None, str(error)
    if not body and not file_url:
        return None, "Type a message or attach a file before sending."
    messages = read_csv(MESSAGES_PATH, MESSAGE_HEADERS)
    message = {
        "id": data.get("id") or f"msg{int(time.time() * 1000)}",
        "request_id": request_id,
        "sender_email": profile.get("email", ""),
        "sender_name": profile.get("name", "") or profile.get("email", ""),
        "message_type": message_type,
        "body": body,
        "file_name": file_name,
        "file_kind": file_kind,
        "file_url": file_url,
        "created_at": time.strftime("%Y-%m-%d %H:%M"),
    }
    messages.append(message)
    write_csv(MESSAGES_PATH, MESSAGE_HEADERS, messages)
    return message, messages_for_visible_requests(profile)


def save_call_signal(data):
    profile = read_profile(data.get("sender_email", ""))
    request_id = data.get("request_id", "")
    if not accepted_request_for_actor(profile, request_id):
        return None, "Calls are locked until the collaboration request is accepted."
    signal = {
        "id": data.get("id") or f"sig{int(time.time() * 1000)}{secrets.randbelow(9999)}",
        "request_id": request_id,
        "sender_email": profile.get("email", ""),
        "signal_type": data.get("signal_type", ""),
        "payload": data.get("payload", {}),
        "created_at": time.time(),
    }
    CALL_SIGNALS.append(signal)
    cutoff = time.time() - 1800
    CALL_SIGNALS[:] = [item for item in CALL_SIGNALS if item.get("created_at", 0) >= cutoff]
    return signal, ""


def visible_call_signals(profile, request_id):
    if not accepted_request_for_actor(profile, request_id):
        return []
    return [
        signal
        for signal in CALL_SIGNALS
        if signal.get("request_id") == request_id
        and signal.get("sender_email", "").lower() != profile.get("email", "").lower()
    ]


def save_team(data):
    profile = read_profile(data.get("owner_email", ""))
    teams = read_csv(TEAMS_PATH, TEAM_HEADERS)
    try:
        team_size = str(min(10, max(2, int(data.get("team_size") or data.get("size") or "5"))))
    except (TypeError, ValueError):
        team_size = "5"
    team = {
        "id": data.get("id") or f"team{int(time.time())}",
        "owner_email": profile.get("email", ""),
        "team_name": data.get("team_name", "Untitled Team"),
        "idea": data.get("idea", ""),
        "project_type": data.get("project_type", "AI Product"),
        "team_size": team_size,
        "open_roles": data.get("open_roles", ""),
        "role_counts": data.get("role_counts", ""),
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
    profile = read_profile(data.get("from_email", ""))
    requests = read_csv(REQUESTS_PATH, REQUEST_HEADERS)
    request = {
        "id": data.get("id") or f"req{int(time.time())}",
        "from_email": data.get("from_email") or profile.get("email", ""),
        "target_email": data.get("target_email", ""),
        "target_name": data.get("target_name", ""),
        "target_role": data.get("target_role", ""),
        "request_type": data.get("request_type", "Collaboration Request"),
        "project": data.get("project", "AI Product Collaboration"),
        "team_name": data.get("team_name", ""),
        "status": "In Progress",
        "created_at": time.strftime("%Y-%m-%d %H:%M"),
        "updated_at": time.strftime("%Y-%m-%d %H:%M"),
    }
    requests.append(request)
    write_csv(REQUESTS_PATH, REQUEST_HEADERS, requests)
    return request, visible_requests_for(profile, requests)


def update_request_status(data):
    profile = read_profile(data.get("actor_email", ""))
    actor = profile.get("email", "").lower()
    request_id = data.get("id", "")
    status = data.get("status", "")
    allowed = {"Accepted", "Rejected", "Completed", "Completion Requested", "Leave Requested", "Ended"}
    if status not in allowed:
        return None, "Invalid request status."
    requests = read_csv(REQUESTS_PATH, REQUEST_HEADERS)
    for item in requests:
        visible_to_actor = (
            item.get("from_email", "").lower() == actor
            or item.get("target_email", "").lower() == actor
            or item.get("target_name", "").strip().lower() == profile.get("name", "").strip().lower()
        )
        if item.get("id") == request_id and visible_to_actor:
            item["status"] = status
            item["updated_at"] = time.strftime("%Y-%m-%d %H:%M")
            write_csv(REQUESTS_PATH, REQUEST_HEADERS, requests)
            return item, visible_requests_for(profile, requests)
    return None, "Request not found for this account."


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
    same_institution = (
        profile.get("institution")
        and candidate.get("institution")
        and profile.get("institution", "").strip().lower() == candidate.get("institution", "").strip().lower()
    )
    same_company = (
        profile.get("company")
        and candidate.get("company")
        and profile.get("company", "").strip().lower() == candidate.get("company", "").strip().lower()
    )

    role_fit = role_matches_target(target_roles, candidate)

    score = 24
    score += 36 if role_fit else -18
    score += min(len(skill) * (14 if priority == "skill_first" else 11), 34)
    score += min(len(project) * 8, 12)
    score += min(len(interest) * 5, 12)
    score += min(len(availability) * (7 if priority == "availability_first" else 4), 10)
    score += min((len(communication) + len(working)) * 3, 8)
    if same_institution or same_company:
        score += 18 if priority == "organisation_first" else 7
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
    if same_institution:
        reasons.append(f"same institution ({candidate.get('institution')})")
    if same_company:
        reasons.append(f"same company ({candidate.get('company')})")
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
    priority = profile.get("search_priority", "role_first")
    team_text = f"{team.get('team_name', '')} {team.get('idea', '')} {team.get('status', '')}".lower()
    same_institution = profile.get("institution") and profile.get("institution", "").lower() in team_text
    score = 40 + min(len(role_overlap) * 24, 36) + min(len(project_overlap) * 18, 18) + min(len(interest_overlap) * 8, 14) + min(len(goal_overlap) * 5, 12) + min(len(stage_overlap) * 4, 8)
    if same_institution:
        score += 14 if priority == "organisation_first" else 5
    score = min(score, 96)
    reasons = []
    if role_overlap:
        reasons.append(f"your preferred role matches open roles ({', '.join(role_overlap)})")
    if project_overlap:
        reasons.append(f"same project type ({', '.join(project_overlap)})")
    if goal_overlap:
        reasons.append(f"team idea matches your target goals ({', '.join(goal_overlap[:4])})")
    if same_institution:
        reasons.append("team context is related to your institution")
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
            "institution": c.get("institution"),
            "company": c.get("company"),
            "verification_status": c.get("verification_status"),
            "reliability_score": c.get("reliability_score"),
        }
        for c in prepared_candidates[:6]
    ]
    prompt = {
        "task": "Rank the best Link-Up collaborators for a user. Return strict JSON only.",
        "mode": mode,
        "matching_standard": {
            "highest_priority": "The user's current search intent: target_roles and target_skills. A candidate matching the requested teammate role should rank higher than a candidate who only shares profile interests.",
            "medium_priority": "Target project type and target project direction.",
            "organisation_priority": "If search_priority is organisation_first, same institution or same company becomes a strong tie-breaker after role and skills. Do not ignore role and skill fit.",
            "lower_priority": "Profile context such as user's own availability, interests, working style, communication style, verification status and reliability score. Use these as tie-breakers and compatibility support, not as the main ranking factor.",
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
    seeded = [
        {
            "team_name": "AI Campus Builders",
            "idea": "Build an AI assistant for student collaboration and study team planning.",
            "project_type": "AI Product",
            "open_roles": "ML Engineer;Backend Engineer;UI/UX Designer",
            "role_counts": "ML Engineer:1;Backend Engineer:1;UI/UX Designer:1",
            "status": "Recruiting",
        },
        {
            "team_name": "GreenHack Sprint",
            "idea": "Prototype a sustainability app for campus waste reporting.",
            "project_type": "Competition",
            "open_roles": "Frontend Developer;Data Processing Engineer;Pitch Presenter",
            "role_counts": "Frontend Developer:1;Data Processing Engineer:1;Pitch Presenter:1",
            "status": "Recruiting",
        },
        {
            "team_name": "ResearchFlow Lab",
            "idea": "Create a lightweight research collaboration dashboard.",
            "project_type": "Research Project",
            "open_roles": "Backend Engineer;Product Designer",
            "role_counts": "Backend Engineer:1;Product Designer:1",
            "status": "Recruiting",
        },
        {
            "team_name": "DataBridge Studio",
            "idea": "Build a data processing pipeline and analytics dashboard for competition submissions.",
            "project_type": "AI Product",
            "open_roles": "Data Processing Engineer;Backend Engineer;Cloud Engineer",
            "role_counts": "Data Processing Engineer:1;Backend Engineer:1;Cloud Engineer:1",
            "status": "Prototype building",
        },
        {
            "team_name": "UX Launch Crew",
            "idea": "Design and test a polished product prototype for a student startup MVP.",
            "project_type": "Startup",
            "open_roles": "UI/UX Designer;Product Designer;Frontend Developer",
            "role_counts": "UI/UX Designer:1;Product Designer:1;Frontend Developer:1",
            "status": "Idea validation",
        },
        {
            "team_name": "Mobile Sprint Lab",
            "idea": "Create a mobile app for smart campus services with API integration.",
            "project_type": "Mobile App",
            "open_roles": "Mobile Developer;Backend Engineer;UI/UX Designer",
            "role_counts": "Mobile Developer:1;Backend Engineer:1;UI/UX Designer:1",
            "status": "MVP development",
        },
        {
            "team_name": "Open Source Mentors",
            "idea": "Coordinate an open source learning platform and contributor onboarding workflow.",
            "project_type": "Web App",
            "open_roles": "Frontend Developer;Backend Engineer;Product Designer",
            "role_counts": "Frontend Developer:1;Backend Engineer:1;Product Designer:1",
            "status": "Prototype building",
        },
        {
            "team_name": "PitchReady Founders",
            "idea": "Prepare a startup pitch, demo video and business validation plan.",
            "project_type": "Startup",
            "open_roles": "Pitch Presenter;Product Designer;Data Processing Engineer",
            "role_counts": "Pitch Presenter:1;Product Designer:1;Data Processing Engineer:1",
            "status": "Pitch preparation",
        },
        {
            "team_name": "SecureCampus Lab",
            "idea": "Build a cybersecurity reporting tool for smart campus safety and incident tracking.",
            "project_type": "Cybersecurity Tool",
            "open_roles": "Cybersecurity Analyst;Backend Engineer;QA Tester",
            "role_counts": "Cybersecurity Analyst:1;Backend Engineer:1;QA Tester:1",
            "status": "Prototype building",
        },
        {
            "team_name": "VR Collaboration Room",
            "idea": "Prototype a virtual reality meeting space for remote student project teams.",
            "project_type": "VR Experience",
            "open_roles": "AR/VR Developer;UI/UX Designer;Full Stack Developer",
            "role_counts": "AR/VR Developer:1;UI/UX Designer:1;Full Stack Developer:1",
            "status": "MVP development",
        },
        {
            "team_name": "InsightOps Data Team",
            "idea": "Create an analytics platform for collaboration outcomes, badges and team success patterns.",
            "project_type": "Data Platform",
            "open_roles": "Data Analyst;Data Processing Engineer;Cloud Engineer",
            "role_counts": "Data Analyst:1;Data Processing Engineer:1;Cloud Engineer:1",
            "status": "Testing and QA",
        },
        {
            "team_name": "PromptFlow Builders",
            "idea": "Design prompt workflows and evaluation tools for explainable AI teammate recommendations.",
            "project_type": "AI Product",
            "open_roles": "AI Prompt Engineer;Machine Learning Engineer;Product Manager",
            "role_counts": "AI Prompt Engineer:1;Machine Learning Engineer:1;Product Manager:1",
            "status": "User research",
        },
        {
            "team_name": "LaunchMarket Crew",
            "idea": "Validate a startup idea with user interviews, pitch materials and market research.",
            "project_type": "Startup",
            "open_roles": "Business Analyst;Content Strategist;Pitch Presenter",
            "role_counts": "Business Analyst:1;Content Strategist:1;Pitch Presenter:1",
            "status": "Idea validation",
        },
    ]
    return [normalize_team(team) for team in seeded + read_csv(TEAMS_PATH, TEAM_HEADERS)]


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


def competition_entries_for(profile):
    email = profile.get("email", "").lower()
    return [
        entry for entry in read_csv(COMPETITION_ENTRIES_PATH, COMPETITION_ENTRY_HEADERS)
        if entry.get("owner_email", "").lower() == email
    ]


def join_competition(data):
    profile = read_profile(data.get("owner_email", ""))
    team_id = data.get("team_id", "")
    competition_title = data.get("competition_title", "")
    team = next((item for item in get_my_teams(profile.get("email")) if item.get("id") == team_id), None)
    if not team:
        return None, "Select one of your created teams before joining a competition."
    if not competition_title:
        return None, "Competition title is missing."
    entries = read_csv(COMPETITION_ENTRIES_PATH, COMPETITION_ENTRY_HEADERS)
    existing = next((
        index for index, item in enumerate(entries)
        if item.get("team_id") == team_id and item.get("competition_title") == competition_title
    ), None)
    entry = {
        "id": data.get("id") or f"entry{int(time.time() * 1000)}",
        "competition_title": competition_title,
        "team_id": team_id,
        "team_name": team.get("team_name", ""),
        "owner_email": profile.get("email", ""),
        "status": "Submitted",
        "created_at": time.strftime("%Y-%m-%d %H:%M"),
    }
    if existing is None:
        entries.append(entry)
    else:
        entry["id"] = entries[existing].get("id") or entry["id"]
        entries[existing] = entry
    write_csv(COMPETITION_ENTRIES_PATH, COMPETITION_ENTRY_HEADERS, entries)
    return entry, competition_entries_for(profile)


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

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

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

    def current_email(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()
            session = SESSIONS.get(token)
            if session:
                return session.get("email", "")
        return ""

    def require_email(self):
        email = self.current_email()
        if not email:
            self.json_response(401, {"authenticated": False, "error": "Please log in first."})
            return ""
        return email

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/":
            self.path = "/Link-up AI matching.html"
            return super().do_GET()
        if path.startswith("/uploads/"):
            safe_name = Path(path.removeprefix("/uploads/")).name
            target = UPLOAD_DIR / safe_name
            if active_storage_provider() == "azure_blob":
                try:
                    raw, mime_type = read_blob_bytes(target)
                except Exception as error:
                    if ResourceNotFoundError is not None and isinstance(error, ResourceNotFoundError):
                        self.send_error(404, "Upload not found")
                        return
                    print("AZURE BLOB UPLOAD READ ERROR:", repr(error), flush=True)
                    self.send_error(500, "Upload storage error")
                    return
                mime_type = mime_type or mimetypes.guess_type(str(target))[0] or "application/octet-stream"
                self.send_response(200)
                self.send_header("Content-Type", mime_type)
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
                return
            if not target.exists() or not target.is_file():
                self.send_error(404, "Upload not found")
                return
            mime_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(target.stat().st_size))
            self.end_headers()
            with target.open("rb") as file:
                self.wfile.write(file.read())
            return
        if path == "/api/session":
            email = self.current_email()
            if not email:
                return self.json_response(200, {"authenticated": False})
            return self.json_response(200, {"authenticated": True, "email": email, "profile": read_profile(email)})
        if path == "/api/data":
            email = self.require_email()
            if not email:
                return
            profile = read_profile(email)
            visible_requests = visible_requests_for(profile)
            return self.json_response(200, {
                "authenticated": True,
                "profile": profile,
                "users": read_users(),
                "teams": get_teams(),
                "my_teams": get_my_teams(profile.get("email")),
                "requests": visible_requests,
                "chat_messages": messages_for_visible_requests(profile),
                "competition_entries": competition_entries_for(profile),
                "competitions": get_competitions(),
                "conversations": get_conversations(),
                "ai_provider": "gemini" if GEMINI_KEY else "fallback",
                "gemini_model": ", ".join(GEMINI_MODEL_FALLBACKS),
                "key_source": "environment" if os.environ.get("GEMINI_API_KEY", "").strip() else ("gemini_api_key.txt" if GEMINI_KEY else "none"),
            })
        if path == "/api/messages":
            email = self.require_email()
            if not email:
                return
            profile = read_profile(email)
            return self.json_response(200, {"messages": messages_for_visible_requests(profile)})
        if path == "/api/calls/signals":
            email = self.require_email()
            if not email:
                return
            profile = read_profile(email)
            request_id = parse_qs(parsed.query).get("request_id", [""])[0]
            return self.json_response(200, {"signals": visible_call_signals(profile, request_id)})
        if path == "/api/settings":
            return self.json_response(200, {
                "gemini_configured": bool(GEMINI_KEY),
                "gemini_model": ", ".join(GEMINI_MODEL_FALLBACKS),
                "key_source": "environment" if os.environ.get("GEMINI_API_KEY", "").strip() else ("gemini_api_key.txt" if GEMINI_KEY else "none"),
            })
        if path == "/api/users":
            return self.json_response(200, {"users": read_users()})
        if path == "/api/storage-health":
            return self.json_response(200, {
                "cloud": IS_CLOUD_DEPLOYMENT,
                "storage_provider": active_storage_provider(),
                "azure_blob_requested": USE_AZURE_BLOB_STORAGE,
                "azure_blob_sdk_loaded": bool(BlobServiceClient),
                "azure_blob_container": AZURE_STORAGE_CONTAINER if USE_AZURE_BLOB_STORAGE else "",
                "data_root": str(DATA_ROOT),
                "data_root_exists": DATA_ROOT.exists(),
                "accounts_file_exists": blob_exists(ACCOUNTS_PATH) if active_storage_provider() == "azure_blob" else ACCOUNTS_PATH.exists(),
                "accounts_count": len(read_accounts()),
                "users_count": len(read_users()),
                "teams_count": len(read_csv(TEAMS_PATH, TEAM_HEADERS)),
                "requests_count": len(read_csv(REQUESTS_PATH, REQUEST_HEADERS)),
                "messages_count": len(read_csv(MESSAGES_PATH, MESSAGE_HEADERS)),
            })
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        print("POST PATH:", path)

        # Register: request OTP
        if path in ["/api/request-otp", "/api/register-send-otp", "/api/request-register-otp"]:
            result, error = request_registration_otp(self.read_json())
            if error:
                return self.json_response(400, {"sent": False, "error": error})
            return self.json_response(200, {"sent": True, **result})

        # Register: verify OTP and create account
        if path == "/api/register":
            result, error = register_account(self.read_json())
            if error:
                return self.json_response(400, {"authenticated": False, "error": error})
            return self.json_response(200, {"authenticated": True, **result})

        # Login: request OTP
        if path in ["/api/request-login-otp", "/api/login-send-otp"]:
            result, error = request_login_otp(self.read_json())
            if error:
                return self.json_response(400, {"sent": False, "error": error})
            return self.json_response(200, {"sent": True, **result})

        # Login: verify OTP
        if path in ["/api/verify-login-otp", "/api/verify-otp"]:
            result, error = verify_login_otp(self.read_json())
            if error:
                return self.json_response(400, {"authenticated": False, "error": error})
            return self.json_response(200, {"authenticated": True, **result})
        if path == "/api/login":
            result, error = login_account(self.read_json())
            if error:
                return self.json_response(400, {"authenticated": False, "error": error})
            return self.json_response(200, {"authenticated": True, **result})
        if path == "/api/logout":
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                SESSIONS.pop(auth.split(" ", 1)[1].strip(), None)
            return self.json_response(200, {"authenticated": False, "logged_out": True})
        if path == "/api/match":
            email = self.require_email()
            if not email:
                return
            match_request = self.read_json()
            match_request["email"] = email
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
            email = self.require_email()
            if not email:
                return
            profile = self.read_json()
            profile["email"] = email
            profile, users = save_profile(profile)
            return self.json_response(200, {"saved": True, "profile": profile, "users": len(users)})
        if path == "/api/teams":
            email = self.require_email()
            if not email:
                return
            data = self.read_json()
            data["owner_email"] = email
            team, teams = save_team(data)
            return self.json_response(200, {"saved": True, "team": team, "my_teams": teams})
        if path == "/api/requests":
            email = self.require_email()
            if not email:
                return
            data = self.read_json()
            data["from_email"] = email
            request, requests = save_request(data)
            return self.json_response(200, {"saved": True, "request": request, "requests": requests})
        if path == "/api/requests/status":
            email = self.require_email()
            if not email:
                return
            data = self.read_json()
            data["actor_email"] = email
            request, result = update_request_status(data)
            if not request:
                return self.json_response(404, {"saved": False, "error": result})
            return self.json_response(200, {"saved": True, "request": request, "requests": result})
        if path == "/api/messages":
            email = self.require_email()
            if not email:
                return
            data = self.read_json()
            data["sender_email"] = email
            message, result = save_chat_message(data)
            if not message:
                return self.json_response(400, {"saved": False, "error": result})
            return self.json_response(200, {"saved": True, "message": message, "messages": result})
        if path == "/api/calls/signals":
            email = self.require_email()
            if not email:
                return
            data = self.read_json()
            data["sender_email"] = email
            signal, error = save_call_signal(data)
            if not signal:
                return self.json_response(400, {"saved": False, "error": error})
            return self.json_response(200, {"saved": True, "signal": signal})
        if path == "/api/competitions/join":
            email = self.require_email()
            if not email:
                return
            data = self.read_json()
            data["owner_email"] = email
            entry, result = join_competition(data)
            if not entry:
                return self.json_response(400, {"saved": False, "error": result})
            return self.json_response(200, {"saved": True, "entry": entry, "competition_entries": result})
        if path == "/api/settings":
            global GEMINI_KEY
            if not ALLOW_RUNTIME_KEY_SAVE:
                return self.json_response(403, {
                    "saved": False,
                    "error": "Gemini API keys must be configured as cloud environment variables in the deployed version.",
                })
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
    print(f"Link-Up AI Matching is running at http://{HOST}:{PORT}")
    print(f"Runtime storage provider: {active_storage_provider()}")
    print(f"Runtime data root: {DATA_ROOT}")
    if USE_AZURE_BLOB_STORAGE:
        print(f"Azure Blob container: {AZURE_STORAGE_CONTAINER}")
    print("Gemini API:", "enabled" if GEMINI_KEY else "not configured, using fallback AI")
    print("Gemini model order:", ", ".join(GEMINI_MODEL_FALLBACKS))
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
