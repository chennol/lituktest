from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_BASE = "https://apiv2.britizen.uk"
SOURCE_URL = "https://britizen.uk/practice/life-in-the-uk-test"
PROJECT_ROOT = Path(__file__).resolve().parent
EXAMS_PATH = PROJECT_ROOT / "exams.json"


def fetch_json(path: str, params: dict[str, str] | None = None) -> Any:
    url = f"{API_BASE}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"

    request = Request(url, headers={"User-Agent": "LifeInTheUKTestImporter/1.0"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def load_existing_exams() -> dict[str, Any]:
    with EXAMS_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if "exams" not in data:
        data = {"metadata": {}, "exams": data}

    data.setdefault("metadata", {})
    data.setdefault("exams", {})
    return data


def map_question(question: dict[str, Any]) -> dict[str, Any]:
    question_id = question["id"]
    return {
        "id": f"britizen-{question_id}",
        "source": "Britizen",
        "sourceQuestionId": question_id,
        "historyKey": f"britizen:question:{question_id}",
        "topic": (question.get("topic") or {}).get("name"),
        "question": question["text"],
        "reference": question.get("explanation") or "",
        "answers": [
            {
                "text": option["text"],
                "isCorrect": bool(option.get("is_correct")),
            }
            for option in question.get("options", [])
        ],
    }


def fetch_britizen_mock_tests(limit: int | None = None) -> dict[str, list[dict[str, Any]]]:
    quiz_list = fetch_json("/quizzes/list", params={"type": "mock"})
    if limit is not None:
        quiz_list = quiz_list[:limit]

    imported: dict[str, list[dict[str, Any]]] = {}
    for quiz in quiz_list:
        detail = fetch_json(f"/quizzes/get/{quiz['slug']}")
        imported[f"Britizen {quiz['slug']}"] = [map_question(question) for question in detail["questions"]]

    return imported


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Britizen mock tests into exams.json.")
    parser.add_argument("--limit", type=int, default=None, help="Import only the first N Britizen tests.")
    args = parser.parse_args()

    data = load_existing_exams()
    imported = fetch_britizen_mock_tests(limit=args.limit)

    data["exams"] = {
        key: value
        for key, value in data["exams"].items()
        if not str(key).startswith("Britizen ")
    }
    data["exams"].update(imported)
    data["metadata"]["britizenSource"] = SOURCE_URL
    data["metadata"]["britizenImportedAt"] = datetime.now(timezone.utc).isoformat()
    data["metadata"]["britizenImportedTests"] = len(imported)

    with EXAMS_PATH.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")

    total_questions = sum(len(questions) for questions in imported.values())
    print(f"Imported {len(imported)} Britizen tests with {total_questions} questions.")


if __name__ == "__main__":
    main()
