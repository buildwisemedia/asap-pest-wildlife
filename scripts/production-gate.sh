#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG_DEFAULT="buildwisemedia/asap-pest-wildlife"
CF_PROJECT_NAME_DEFAULT="asap-pest-wildlife"
PRODUCTION_DOMAIN_DEFAULT="https://removeasap.com"
PRODUCTION_BRANCH="${PRODUCTION_BRANCH:-production}"
INTEGRATION_BRANCH="${INTEGRATION_BRANCH:-main}"
RULESET_NAME="${RULESET_NAME:-production-release-gate}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-client-production}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/production-gate.sh [check]
  scripts/production-gate.sh qa-gate <dir>
  scripts/production-gate.sh apply-github
  scripts/production-gate.sh apply-cloudflare --confirm
  scripts/production-gate.sh rollback-cloudflare --confirm

Subcommands:
  check                  Read-only state check. This is the default.
  qa-gate <dir>          Validate production site files in <dir>.
  apply-github           Create/update the production branch ruleset and environment.
  apply-cloudflare       Set the Cloudflare Pages production branch to production.
  rollback-cloudflare    Emergency reset of the Pages production branch to main.

Environment:
  CLOUDFLARE_API_TOKEN   Required for Cloudflare read/write API checks.
  CLOUDFLARE_ACCOUNT_ID  Required for Cloudflare read/write API checks.
  CF_PAGES_PROJECT_NAME  Optional, defaults to asap-pest-wildlife.
  PRODUCTION_DOMAIN      Optional, defaults to https://removeasap.com.
  GITHUB_ENV_REVIEWER    Optional GitHub username for the environment reviewer.
USAGE
}

log() {
  printf '%s\n' "$*"
}

warn() {
  printf 'WARN: %s\n' "$*" >&2
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

repo_slug() {
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s\n' "$GITHUB_REPOSITORY"
    return
  fi

  local origin
  origin="$(git config --get remote.origin.url 2>/dev/null || true)"
  case "$origin" in
    https://github.com/*.git)
      origin="${origin#https://github.com/}"
      printf '%s\n' "${origin%.git}"
      ;;
    git@github.com:*.git)
      origin="${origin#git@github.com:}"
      printf '%s\n' "${origin%.git}"
      ;;
    https://github.com/*)
      origin="${origin#https://github.com/}"
      printf '%s\n' "$origin"
      ;;
    *)
      printf '%s\n' "$REPO_SLUG_DEFAULT"
      ;;
  esac
}

github_api() {
  gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

cf_project_name() {
  printf '%s\n' "${CF_PAGES_PROJECT_NAME:-$CF_PROJECT_NAME_DEFAULT}"
}

cf_endpoint() {
  local project
  project="$(cf_project_name)"
  printf 'https://api.cloudflare.com/client/v4/accounts/%s/pages/projects/%s\n' "$CLOUDFLARE_ACCOUNT_ID" "$project"
}

cf_api() {
  local method="$1"
  local data_file="${2:-}"
  local endpoint
  endpoint="$(cf_endpoint)"

  if [ -n "$data_file" ]; then
    curl -fsS \
      --request "$method" \
      --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      --header "Content-Type: application/json" \
      --data "@$data_file" \
      "$endpoint"
  else
    curl -fsS \
      --request "$method" \
      --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "$endpoint"
  fi
}

print_cf_state_from_json() {
  python3 - <<'PY'
import json
import os

data = json.loads(os.environ["RESPONSE_JSON"])
if not data.get("success", False):
    errors = data.get("errors") or []
    print(f"Cloudflare Pages: API returned success=false errors={errors}")
    sys.exit(1)

project = data.get("result") or {}
source = project.get("source") or {}
config = source.get("config") or {}
branch = project.get("production_branch") or config.get("production_branch") or "unknown"
enabled = config.get("production_deployments_enabled", project.get("production_deployments_enabled", "unknown"))
print(f"Cloudflare Pages: production_branch={branch} production_deployments_enabled={enabled}")
PY
}

cloudflare_state_check() {
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    log "Cloudflare Pages: unavailable (set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for live read)"
    log "Cloudflare Pages: project=$(cf_project_name)"
    return 0
  fi

  local response
  if response="$(cf_api GET 2>&1)"; then
    RESPONSE_JSON="$response" print_cf_state_from_json || true
  else
    warn "Cloudflare Pages read failed: $response"
  fi
}

github_ruleset_check() {
  require_cmd gh
  local repo response
  repo="$(repo_slug)"
  if response="$(github_api "/repos/$repo/rulesets?targets=branch" 2>&1)"; then
    RESPONSE_JSON="$response" python3 - "$RULESET_NAME" <<'PY'
import json
import os
import sys

name = sys.argv[1]
data = json.loads(os.environ["RESPONSE_JSON"])
for item in data:
    if item.get("name") == name:
        print(f"GitHub ruleset: present id={item.get('id')} enforcement={item.get('enforcement')}")
        break
else:
    print("GitHub ruleset: absent")
PY
  else
    warn "GitHub ruleset check failed: $response"
  fi
}

github_environment_check() {
  require_cmd gh
  local repo env encoded response
  repo="$(repo_slug)"
  env="$ENVIRONMENT_NAME"
  encoded="$(urlencode "$env")"
  if response="$(github_api "/repos/$repo/environments/$encoded" 2>&1)"; then
    RESPONSE_JSON="$response" python3 - <<'PY'
import json
import os

env = json.loads(os.environ["RESPONSE_JSON"])
rules = env.get("protection_rules") or []
rule_types = ",".join(sorted({rule.get("type", "unknown") for rule in rules})) or "none"
print(f"GitHub environment: present name={env.get('name')} protection_rules={rule_types}")
PY
  else
    if printf '%s\n' "$response" | grep -q 'HTTP 404'; then
      log "GitHub environment: absent"
    else
      warn "GitHub environment check failed: $response"
    fi
  fi
}

domain_check() {
  local domain code
  domain="${PRODUCTION_DOMAIN:-$PRODUCTION_DOMAIN_DEFAULT}"
  code="$(curl -L -sS -o /dev/null -w "%{http_code}" --max-time 15 "$domain" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    log "Production domain: $domain HTTP 200"
  else
    log "Production domain: $domain HTTP ${code:-unavailable}"
  fi
}

check_state() {
  log "Production gate state check"
  log "Repo: $(repo_slug)"
  cloudflare_state_check
  github_ruleset_check
  github_environment_check
  domain_check
}

record_failure() {
  local failures_file="$1"
  shift
  printf '%s\n' "$*" >> "$failures_file"
}

qa_required_files() {
  local root="$1"
  local failures_file="$2"
  local required_files=(
    "index.html"
    "_redirects"
    "robots.txt"
    "llms.txt"
  )
  local required_dirs=(
    "privacy-policy"
    "terms-of-service"
  )
  local path

  for path in "${required_files[@]}"; do
    if [ ! -f "$root/$path" ]; then
      record_failure "$failures_file" "missing required file: $path"
    fi
  done

  for path in "${required_dirs[@]}"; do
    if [ ! -d "$root/$path" ]; then
      record_failure "$failures_file" "missing required directory: $path/"
    elif [ ! -f "$root/$path/index.html" ]; then
      record_failure "$failures_file" "missing required page file: $path/index.html"
    fi
  done
}

qa_vendor_names() {
  local root="$1"
  local failures_file="$2"
  local file matches
  local vendor_pattern='(^|[^[:alnum:]_])(cloudflare|supabase|gohighlevel|ghl|resend|cal\.com|vercel|netlify)([^[:alnum:]_]|$)'

  while IFS= read -r -d '' file; do
    if ! html_is_client_visible "$root" "$file"; then
      continue
    fi

    matches="$(grep -Eini "$vendor_pattern" "$file" || true)"
    if [ -n "$matches" ]; then
      record_failure "$failures_file" "vendor name found in client-visible HTML: ${file#"$root"/}"
      printf '%s\n' "$matches" | sed 's/^/  /' >> "$failures_file"
    fi
  done < <(find "$root" -type f -name '*.html' -print0)
}

html_is_client_visible() {
  local root="$1"
  local file="$2"

  case "$file" in
    "$root/privacy-policy/"*|"$root/terms-of-service/"*)
      return 1
      ;;
  esac

  python3 - "$file" <<'PY'
import re
import sys

with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as handle:
    head = handle.read(8192).lower()

robots_noindex = re.search(
    r"<meta[^>]+name=[\"']robots[\"'][^>]+content=[\"'][^\"']*(noindex|nofollow|noarchive)",
    head,
)
sys.exit(1 if robots_noindex else 0)
PY
}

qa_placeholders() {
  local root="$1"
  local failures_file="$2"
  local file matches
  local placeholder_pattern='(^|[^[:alnum:]_])(TODO|PENDING_|REPLACE_ME)([^[:alnum:]_]|$)|lorem[[:space:]]+ipsum'

  while IFS= read -r -d '' file; do
    case "$file" in
      "$root/.git/"*|"$root/node_modules/"*)
        continue
        ;;
    esac

    matches="$(grep -Eini "$placeholder_pattern" "$file" || true)"
    if [ -n "$matches" ]; then
      record_failure "$failures_file" "placeholder text found: ${file#"$root"/}"
      printf '%s\n' "$matches" | sed 's/^/  /' >> "$failures_file"
    fi
  done < <(
    find "$root" -type f \
      \( -name '*.html' -o -name '*.txt' -o -name '_redirects' -o -name 'robots.txt' -o -name 'llms.txt' \) \
      -print0
  )
}

qa_gate() {
  local root="${1:-}"
  if [ -z "$root" ]; then
    die "qa-gate requires a directory"
  fi
  if [ ! -d "$root" ]; then
    die "qa-gate directory does not exist: $root"
  fi
  require_cmd python3

  root="$(cd "$root" && pwd)"
  local failures_file
  failures_file="$(mktemp)"

  qa_required_files "$root" "$failures_file"
  qa_vendor_names "$root" "$failures_file"
  qa_placeholders "$root" "$failures_file"

  if [ -s "$failures_file" ]; then
    log "QA gate: FAIL"
    cat "$failures_file"
    rm -f "$failures_file"
    return 1
  fi

  log "QA gate: PASS"
  log "Checked required files, client-visible vendor names, and placeholder text in $root"
  rm -f "$failures_file"
}

ruleset_id_for_name() {
  local repo="$1"
  local response
  response="$(github_api "/repos/$repo/rulesets?targets=branch")"
  RESPONSE_JSON="$response" python3 - "$RULESET_NAME" <<'PY'
import json
import os
import sys

name = sys.argv[1]
for item in json.loads(os.environ["RESPONSE_JSON"]):
    if item.get("name") == name:
        print(item.get("id", ""))
        break
PY
}

write_ruleset_payload() {
  local payload_file="$1"

  python3 - "$RULESET_NAME" "$PRODUCTION_BRANCH" > "$payload_file" <<'PY'
import json
import sys

name, branch = sys.argv[1], sys.argv[2]
payload = {
    "name": name,
    "target": "branch",
    "enforcement": "active",
    "conditions": {
        "ref_name": {
            "include": [f"refs/heads/{branch}"],
            "exclude": [],
        }
    },
    "rules": [
        {"type": "deletion"},
        {"type": "non_fast_forward"},
    ],
}
print(json.dumps(payload, indent=2, sort_keys=True))
PY
}

apply_ruleset() {
  local repo="$1"
  local payload_file ruleset_id
  payload_file="$(mktemp)"
  write_ruleset_payload "$payload_file"

  ruleset_id="$(ruleset_id_for_name "$repo")"
  if [ -n "$ruleset_id" ]; then
    log "Updating GitHub ruleset '$RULESET_NAME' id=$ruleset_id"
    github_api --method PUT "/repos/$repo/rulesets/$ruleset_id" --input "$payload_file" >/dev/null
  else
    log "Creating GitHub ruleset '$RULESET_NAME'"
    github_api --method POST "/repos/$repo/rulesets" --input "$payload_file" >/dev/null
  fi
  rm -f "$payload_file"
}

write_environment_payload() {
  local reviewer_login="$1"
  local payload_file="$2"
  local reviewer_json

  reviewer_json="$(github_api "/users/$reviewer_login")"
  REVIEWER_JSON="$reviewer_json" python3 - "$reviewer_login" > "$payload_file" <<'PY'
import json
import os
import sys

login = sys.argv[1]
reviewer = json.loads(os.environ["REVIEWER_JSON"])
if reviewer.get("type") != "User":
    raise SystemExit(f"{login} is not a GitHub User account")
payload = {
    "wait_timer": 0,
    "prevent_self_review": False,
    "reviewers": [
        {
            "type": "User",
            "id": reviewer["id"],
        }
    ],
    "deployment_branch_policy": None,
}
print(json.dumps(payload, indent=2, sort_keys=True))
PY
}

environment_has_required_reviewers() {
  local environment_json="$1"

  RESPONSE_JSON="$environment_json" python3 - <<'PY'
import json
import os
import sys

env = json.loads(os.environ["RESPONSE_JSON"])
for rule in env.get("protection_rules") or []:
    if rule.get("type") == "required_reviewers" and rule.get("reviewers"):
        sys.exit(0)
sys.exit(1)
PY
}

apply_environment() {
  local repo="$1"
  local encoded reviewer_login payload_file existing_environment
  encoded="$(urlencode "$ENVIRONMENT_NAME")"
  reviewer_login="${GITHUB_ENV_REVIEWER:-}"

  if [ -z "$reviewer_login" ] && existing_environment="$(github_api "/repos/$repo/environments/$encoded" 2>/dev/null)"; then
    if environment_has_required_reviewers "$existing_environment"; then
      log "Environment '$ENVIRONMENT_NAME' already has required reviewers; preserving existing reviewer policy"
      return
    fi
  fi

  if [ -z "$reviewer_login" ]; then
    reviewer_login="$(github_api user --jq '.login')"
  fi
  if [ -z "$reviewer_login" ]; then
    die "could not determine GitHub environment reviewer"
  fi

  payload_file="$(mktemp)"
  write_environment_payload "$reviewer_login" "$payload_file"

  log "Creating/updating environment '$ENVIRONMENT_NAME' with required reviewer '$reviewer_login'"
  github_api --method PUT "/repos/$repo/environments/$encoded" --input "$payload_file" >/dev/null
  rm -f "$payload_file"
}

apply_github() {
  require_cmd gh
  require_cmd python3
  local repo
  repo="$(repo_slug)"

  cat <<PLAN
Plan:
  Repo: $repo
  Ruleset: $RULESET_NAME
  Ruleset target: refs/heads/$PRODUCTION_BRANCH
  Rules: block deletion, block non-fast-forward
  Ruleset bypass actor: none
  Environment: $ENVIRONMENT_NAME with a required reviewer

This mutates GitHub repository settings. It does not touch Cloudflare.
PLAN

  apply_ruleset "$repo"
  apply_environment "$repo"
  log "GitHub gate applied."
}

require_confirm() {
  if [ "${1:-}" != "--confirm" ]; then
    die "this mutating command requires --confirm"
  fi
}

write_cf_patch_payload() {
  local target_branch="$1"
  local current_json_file="$2"
  local payload_file="$3"

  python3 - "$target_branch" "$current_json_file" > "$payload_file" <<'PY'
import json
import sys

target_branch = sys.argv[1]
with open(sys.argv[2], encoding="utf-8") as handle:
    data = json.load(handle)

project = data.get("result") or {}
source = project.get("source") or {}
config = dict(source.get("config") or {})
config["production_branch"] = target_branch
config["production_deployments_enabled"] = True

payload = {"production_branch": target_branch}
if source:
    payload["source"] = {
        "type": source.get("type", "github"),
        "config": config,
    }

print(json.dumps(payload, indent=2, sort_keys=True))
PY
}

verify_cf_target() {
  local response_file="$1"
  local target_branch="$2"

  python3 - "$target_branch" "$response_file" <<'PY'
import json
import sys

target = sys.argv[1]
with open(sys.argv[2], encoding="utf-8") as handle:
    data = json.load(handle)

if not data.get("success", False):
    raise SystemExit(f"Cloudflare API success=false errors={data.get('errors')}")

project = data.get("result") or {}
config = ((project.get("source") or {}).get("config") or {})
branch = project.get("production_branch") or config.get("production_branch")
enabled = config.get("production_deployments_enabled", project.get("production_deployments_enabled"))

if branch != target:
    raise SystemExit(f"production_branch={branch!r}, expected {target!r}")
if enabled is not True:
    raise SystemExit(f"production_deployments_enabled={enabled!r}, expected True")

print(f"Cloudflare verified: production_branch={branch} production_deployments_enabled={enabled}")
PY
}

patch_cloudflare_branch() {
  local target_branch="$1"
  require_cmd curl
  require_cmd python3
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    die "CLOUDFLARE_API_TOKEN is required"
  fi
  if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    die "CLOUDFLARE_ACCOUNT_ID is required"
  fi

  local before_file payload_file after_file
  before_file="$(mktemp)"
  payload_file="$(mktemp)"
  after_file="$(mktemp)"

  log "Reading Cloudflare Pages project '$(cf_project_name)'"
  cf_api GET > "$before_file"
  write_cf_patch_payload "$target_branch" "$before_file" "$payload_file"

  log "Patching Cloudflare Pages production branch to '$target_branch'"
  cf_api PATCH "$payload_file" > "$after_file"
  verify_cf_target "$after_file" "$target_branch"
  rm -f "$before_file" "$payload_file" "$after_file"
}

apply_cloudflare() {
  require_confirm "${1:-}"
  patch_cloudflare_branch "$PRODUCTION_BRANCH"
}

rollback_cloudflare() {
  require_confirm "${1:-}"
  patch_cloudflare_branch "$INTEGRATION_BRANCH"
}

main() {
  local command="${1:-check}"
  case "$command" in
    check)
      check_state
      ;;
    qa-gate)
      shift
      qa_gate "${1:-}"
      ;;
    apply-github)
      apply_github
      ;;
    apply-cloudflare)
      shift
      apply_cloudflare "${1:-}"
      ;;
    rollback-cloudflare)
      shift
      rollback_cloudflare "${1:-}"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage
      die "unknown command: $command"
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
