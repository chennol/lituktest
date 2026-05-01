from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXAMS_PATH = Path(__file__).resolve().parent / "exams.json"


def normalize(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')).strip().lower()


def duplicate_key(question: dict[str, Any]) -> str:
    correct_answers = sorted(
        normalize(answer.get("text"))
        for answer in question.get("answers", [])
        if answer.get("isCorrect")
    )
    return f"{normalize(question.get('question'))}::{'|'.join(correct_answers)}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove duplicate questions from exams.json.")
    parser.add_argument("--dry-run", action="store_true", help="Report duplicates without writing exams.json.")
    args = parser.parse_args()

    with EXAMS_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    exams = data.get("exams", data)
    seen: set[str] = set()
    removed: list[dict[str, Any]] = []

    for exam_name, questions in exams.items():
        kept_questions = []
        for question in questions:
            key = duplicate_key(question)
            if key in seen:
                removed.append(
                    {
                        "exam": exam_name,
                        "id": question.get("id"),
                        "question": question.get("question"),
                    }
                )
                continue

            seen.add(key)
            kept_questions.append(question)

        exams[exam_name] = kept_questions

    print(f"Removed {len(removed)} duplicate questions.")
    if removed:
        print("First removed duplicates:")
        for item in removed[:10]:
            print(f"- {item['exam']} / {item['id']}: {item['question']}")

    if args.dry_run:
        return

    data.setdefault("metadata", {})
    data["metadata"]["duplicateCleanupAt"] = datetime.now(timezone.utc).isoformat()
    data["metadata"]["duplicateCleanupStrategy"] = "normalized question text + correct answer set"
    data["metadata"]["duplicateQuestionsRemoved"] = len(removed)

    with EXAMS_PATH.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


if __name__ == "__main__":
    main()
