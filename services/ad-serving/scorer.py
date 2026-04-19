def _normalize_token(value: str) -> str:
    return (value or "").lower().strip().split("-", 1)[0]


def score_campaigns(
    user: dict,
    campaigns: list[dict],
    page_category: str,
    click_history: dict[str, int] | None = None,
) -> list[dict]:
    user_interests = set(user.get("interests") or [])
    normalized_user_interests = {_normalize_token(i) for i in user_interests if i}
    user_age = user.get("age") or 25
    page_token = _normalize_token(page_category)
    click_history = click_history or {}
    scores = []

    for campaign in campaigns:
        brand = campaign.get("brand") or {}
        target_interests = set(brand.get("target_interests") or [])
        normalized_target = {_normalize_token(i) for i in target_interests if i}

        overlap = len(normalized_user_interests & normalized_target) / max(len(normalized_target), 1)

        category_boost = 1.6 if page_token in normalized_target else 1.0

        tmin = brand.get("target_age_min") or 18
        tmax = brand.get("target_age_max") or 65
        age_match = 1.0 if tmin <= user_age <= tmax else 0.5

        history_clicks = int(click_history.get(str(campaign.get("id")), 0))
        history_boost = min(1.35, 1.0 + (0.08 * history_clicks))

        score = overlap * category_boost * age_match * history_boost
        row = {**campaign, "score": score}
        scores.append(row)

    return sorted(scores, key=lambda x: x["score"], reverse=True)
