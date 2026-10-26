"""Independent synthetic generator. Never imports the learner model or FSRS."""
import csv
import hashlib
import math
import random
from datetime import datetime, timedelta, timezone

PROFILES = [
    dict(name="fast_high", gain=.18, half_life=18),
    dict(name="fast_fast_forgetting", gain=.18, half_life=1.5),
    dict(name="slow_high", gain=.035, half_life=18),
    dict(name="slow_fast_forgetting", gain=.035, half_life=1.5),
    dict(name="uneven_subjects", gain=.10, half_life=8, uneven=True),
    dict(name="weak_prerequisite", gain=.10, half_life=8, prerequisite=True),
    dict(name="irregular", gain=.10, half_life=8, irregular=True),
    dict(name="immediate_only", gain=.12, half_life=.8, familiarity=.65),
    dict(name="activity_sensitive", gain=.08, half_life=6, review_effect=2.0, feedback_effect=2.5),
    dict(name="sparse", gain=.10, half_life=8, count=6),
    dict(name="drifting", gain=.13, half_life=8, drift=True),
    dict(name="noisy_incomplete", gain=.08, half_life=6, noise=.18, incomplete=.18),
]
COLUMNS = [
    "student_id", "event_id", "session_id", "question_id", "activity_id",
    "discipline_at_attempt", "topic_at_attempt", "skill_id", "prerequisite_ids",
    "occurred_at", "event_type", "is_correct", "gabarito_status",
    "confidence_level", "active_time_ms", "time_quality", "used_help", "hint_count",
    "feedback_type", "attempt_number", "prior_exposures", "elapsed_hours",
    "variant_id", "recommendation_id", "origin_type", "session_complete",
    "classification_origin", "classification_version",
]

def forgetting(days, half_life, form):
    """Hypotheses only. Both parameterizations have R(half_life)=0.5."""
    if half_life <= 0 or days < 0:
        raise ValueError("Invalid simulator memory parameters")
    if form == "exponential":
        return 2 ** (-days / half_life)
    if form == "power":
        return 1 / (1 + days / half_life)
    raise ValueError("Unknown forgetting function")

def generate(seed, interactions=48, profiles=None):
    rng = random.Random(seed)
    profiles = [dict(p) for p in (PROFILES if profiles is None else profiles)]
    if not profiles or any(not p.get("name") or not 0 <= p.get("gain", -1) <= 1 or p.get("half_life", 0) <= 0 for p in profiles):
        raise ValueError("Profiles require name, acquisition gain [0,1] and positive half-life")
    rng.shuffle(profiles)  # Pseudonyms do not encode profile labels.
    events, truth, metadata = [], [], []
    for index, profile in enumerate(profiles):
        student = "s%02d" % index
        local = random.Random(seed * 1009 + index)
        form = ("exponential", "power")[index % 2]
        state = {s: {"k": .12, "h": profile["half_life"], "last": 0.0} for s in ("A", "B")}
        if profile.get("uneven"):
            state["A"].update(k=.75, h=20)
            state["B"].update(k=.05, h=1.5)
        if profile.get("prerequisite"):
            state["A"]["k"] = .025
        seen, seen_skills, day = {}, set(), 0.
        count = profile.get("count", interactions)
        metadata.append(dict(student_id=student, parameters=profile, forgetting_form=form))
        for t in range(count):
            day += local.uniform(.05, 6) if profile.get("irregular") else (.08 if t % 4 else 2.5)
            skill = local.choice(("A", "B"))
            activity = local.choice(("practice", "review", "feedback"))
            item = "%s-q%02d" % (skill, local.randrange(8))
            previous_count = seen.get(item, 0)
            current = state[skill]
            lag = day - current["last"]
            retrieval = forgetting(lag, current["h"], form)
            prerequisite = .25 + .75 * state["A"]["k"] if skill == "B" and profile.get("prerequisite") else 1.
            p = .20 + .77 * current["k"] * retrieval * prerequisite
            p += profile.get("familiarity", 0) * math.exp(-lag / .25) * (1 - p)
            noise = profile.get("noise", .025)
            drift = profile.get("drift", False) and t >= count // 2
            if drift:
                noise += .12
            p = max(.0001, min(.9999, p * (1 - noise) + (1 - p) * noise))
            outcome = local.random() < p
            incomplete = local.random() < profile.get("incomplete", 0)
            helped = local.random() < .06
            event = hashlib.sha256(("%s|%s|%s" % (seed, student, t)).encode("utf-8")).hexdigest()[:24]
            instant = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=day)
            confidence = min(5, max(1, round(1 + 4 * p + local.gauss(0, .8))))
            events.append(dict(zip(COLUMNS, [
                student, event, "%s-session%03d" % (student, t // 4), item, activity,
                "Discipline-" + skill, "Skill-" + skill, skill, "A" if skill == "B" else "",
                instant.isoformat().replace("+00:00", "Z"), "ANSWER_SUBMITTED",
                "" if incomplete else str(outcome).lower(),
                "AUSENTE" if incomplete else "DEFINITIVO", confidence,
                "" if incomplete else local.randrange(8000, 90000),
                "UNKNOWN" if incomplete else "SIMULATOR_RECORDED",
                str(helped).lower(), int(helped), "ELABORATIVE" if activity == "feedback" else "STANDARD",
                previous_count + 1, previous_count, "" if skill not in seen_skills else lag * 24, item + "-v1", "",
                "SYNTHETIC_BENCHMARK", str(not incomplete).lower(), "SIMULATOR_COURSE_MAP", "lab-v1"
            ])))
            truth.append(dict(event_id=event, student_id=student, profile=profile["name"],
                              skill=skill, knowledge=current["k"], retrieval=retrieval,
                              half_life_days=current["h"], probability_correct=p,
                              forgetting_form=form, observed_correct=None if incomplete else int(outcome)))
            seen_skills.add(skill)
            gain = profile["gain"]
            if incomplete:
                gain *= .2
            if drift:
                gain *= .35
            if profile.get("uneven") and skill == "B":
                gain *= .35
            effect = profile.get(activity + "_effect", 1.)
            current["k"] += (1 - current["k"]) * gain * effect * prerequisite
            current["k"] = min(.995, current["k"])
            current["h"] *= 1 + .025 * effect
            current["last"] = day
            seen[item] = previous_count + 1
    return events, truth, metadata

def write_events(path, events):
    with open(path, "w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(events)

def validate(events):
    """No production storage; reject instead of silently repairing the experiment."""
    seen = set()
    for row in events:
        if set(row) != set(COLUMNS):
            raise ValueError("Unknown/missing columns; latent data must not enter observations")
        for key in ("student_id", "event_id", "session_id", "question_id", "skill_id"):
            if not row[key]:
                raise ValueError("Missing identity")
        if row["event_id"] in seen:
            raise ValueError("Duplicate event identity")
        seen.add(row["event_id"])
        text = row["occurred_at"]
        instant = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if instant.tzinfo is None or instant.utcoffset() is None:
            raise ValueError("Ambiguous timestamp")
        if row["origin_type"] != "SYNTHETIC_BENCHMARK":
            raise ValueError("Laboratory accepts only explicitly synthetic input")
        if str(row["is_correct"]) not in ("true", "false", ""):
            raise ValueError("Invalid graded outcome")
        if int(row["attempt_number"]) < 1 or (row["elapsed_hours"] != "" and float(row["elapsed_hours"]) < 0):
            raise ValueError("Invalid temporal history")
        if row["used_help"] not in ("true", "false") or row["session_complete"] not in ("true", "false"):
            raise ValueError("Ambiguous response conditions")
    return True

def identifiability_probe():
    """An observation-equivalence witness, not a learner-parameter estimator."""
    return dict(
        design="TWO_MODELS_SAME_K_DIFFERENT_HALF_LIFE",
        knowledge=.8, half_lives_days=[1.5, 18],
        immediate_probabilities=[.20 + .77 * .8] * 2,
        day7_probabilities=[.20 + .77 * .8 * forgetting(7, h, "exponential") for h in (1.5, 18)],
        conclusion="Immediate-only responses cannot identify these retention parameters.",
        motor_retention_parameter_estimation="NOT_SUPPORTED",
        observations_needed_to_identify="NOT_ESTIMATED",
    )
