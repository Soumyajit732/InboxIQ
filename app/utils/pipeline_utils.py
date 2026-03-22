def deduplicate_tasks(results):
    seen = set()
    unique = []

    for r in results:
        task = r.get("task")

        if not task:
            continue

        key = task.lower().strip()

        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique


def sort_by_priority(results):
    return sorted(results, key=lambda x: x.get("priority", 1), reverse=True)


def filter_low_confidence(results, threshold=0.4):
    return [r for r in results if r.get("confidence", 0) >= threshold]