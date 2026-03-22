def compute_priority(task, deadline, sender):
    score = 0

    # urgency keywords
    urgent_words = ["urgent", "asap", "important", "deadline"]

    if any(word in task.lower() for word in urgent_words):
        score += 5

    # deadline proximity
    if deadline:
        score += 3

    # sender importance (basic)
    if "professor" in sender.lower():
        score += 2

    return score