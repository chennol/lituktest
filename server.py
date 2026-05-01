from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile


ROOT = Path(__file__).resolve().parent
HISTORY_PATH = ROOT / "data" / "history.json"
MAX_HISTORY_BYTES = 5 * 1024 * 1024


def default_history() -> dict:
    return {
        "questionStats": {},
        "failedQuestions": [],
        "favoriteQuestions": [],
        "updatedAt": None,
    }


def read_history() -> dict:
    if not HISTORY_PATH.exists():
        return default_history()

    try:
        with HISTORY_PATH.open("r", encoding="utf-8") as file:
            history = json.load(file)
    except (OSError, json.JSONDecodeError):
        return default_history()

    if not isinstance(history, dict):
        return default_history()

    return {
        "questionStats": history.get("questionStats") if isinstance(history.get("questionStats"), dict) else {},
        "failedQuestions": history.get("failedQuestions") if isinstance(history.get("failedQuestions"), list) else [],
        "favoriteQuestions": history.get("favoriteQuestions") if isinstance(history.get("favoriteQuestions"), list) else [],
        "updatedAt": history.get("updatedAt"),
    }


def write_history(history: dict) -> None:
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "questionStats": history.get("questionStats") if isinstance(history.get("questionStats"), dict) else {},
        "failedQuestions": history.get("failedQuestions") if isinstance(history.get("failedQuestions"), list) else [],
        "favoriteQuestions": history.get("favoriteQuestions") if isinstance(history.get("favoriteQuestions"), list) else [],
        "updatedAt": history.get("updatedAt"),
    }

    with NamedTemporaryFile("w", encoding="utf-8", dir=HISTORY_PATH.parent, delete=False) as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temp_path = Path(file.name)

    temp_path.replace(HISTORY_PATH)


class HistoryHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status: HTTPStatus, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/history":
            self.send_json(HTTPStatus.OK, read_history())
            return

        super().do_GET()

    def do_PUT(self):
        if self.path != "/api/history":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length > MAX_HISTORY_BYTES:
            self.send_error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return

        try:
            body = self.rfile.read(content_length).decode("utf-8")
            history = json.loads(body or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        if not isinstance(history, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "History must be a JSON object")
            return

        write_history(history)
        self.send_json(HTTPStatus.OK, read_history())


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Life in the UK practice app with history sync.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), HistoryHandler)
    print(f"Serving on http://{args.host}:{args.port}/")
    print(f"History will be saved to {HISTORY_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
