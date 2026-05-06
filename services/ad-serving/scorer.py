def score_campaigns(user: dict, campaigns: list[dict], page_category: str) -> list[dict]:
    user_interests = set(user.get("interests") or [])
    user_age = user.get("age") or 25
    scores = []

    for campaign in campaigns:
        brand = campaign.get("brand") or {}
        target_interests = set(brand.get("target_interests") or [])

        overlap = len(user_interests & target_interests) / max(len(target_interests), 1)

        category_boost = 1.5 if page_category in target_interests else 1.0

        tmin = brand.get("target_age_min") or 18
        tmax = brand.get("target_age_max") or 65
        age_match = 1.0 if tmin <= user_age <= tmax else 0.5

        score = overlap * category_boost * age_match
        row = {**campaign, "score": score}
        scores.append(row)

    return sorted(scores, key=lambda x: x["score"], reverse=True)
