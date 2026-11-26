#!/usr/bin/env python3
"""Prepare, check, and serve the Live2D portrait previews on this computer."""

import argparse
from contextlib import closing
from functools import partial
from http.client import HTTPConnection, HTTPException
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.parse import quote
import wave


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8767
RIG = Path("live2d-face-rig-v1")
PORTRAITS = (Path("live2d-painted-face-trial"), Path("live2d-copper-face-trial"))
MANIFESTS = tuple(
    folder / f"{portrait}-{model}.model3.json"
    for folder, portrait in zip(PORTRAITS, ("painted", "copper"))
    for model in ("face", "performance")
)
AUDIO = PORTRAITS[0] / "conversation-voice.wav"
PAGES = (Path("index.html"),) + tuple(
    folder / name
    for folder in PORTRAITS
    for name in ("index.html", "vowel-comparison.html")
)
VTUBER = Path("vtuber-front")
VTUBER_FILES = tuple(
    VTUBER / name for name in (
        "index.html", "preview.mjs", "draw.mjs", "pose.mjs", "mesh.mjs",
        "portrait.png", "closed-eyes.png", "open-mouth.png",
    )
) + tuple(
    Path("vtuber-full-body") / name for name in (
        "index.html", "preview.mjs", "draw.mjs", "motion.mjs", "portrait.png",
        "walk-profile.png", "walk-profile-under-arm.png",
    )
)
MODULES = (RIG / "motion-keys.mjs",) + tuple(
    PORTRAITS[0] / name
    for name in (
        "face-preview.mjs", "vowel-comparison.mjs", "vowel-keys.mjs",
        "conversation-keys.mjs", "body-keys.mjs",
    )
)


class PreviewHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript"}


class QuietPreviewHandler(PreviewHandler):
    def log_message(self, format, *args):
        pass


def require_files(paths):
    unavailable = []
    for path in paths:
        file = ROOT / path
        if not file.is_file() or file.stat().st_size == 0:
            unavailable.append(path.as_posix())
    if unavailable:
        raise ValueError("必要なファイルが見つからないか、空です\n  " + "\n  ".join(unavailable))


def manifest_files(manifest):
    try:
        settings = json.loads((ROOT / manifest).read_text(encoding="utf-8-sig"))
        references = settings["FileReferences"]
        textures = references["Textures"]
        if settings["Version"] != 3 or not isinstance(textures, list) or not textures:
            raise ValueError("Cubism 3 のテクスチャ付きモデル設定が必要です")
        names = [references["Moc"], *textures]
        for key in ("DisplayInfo", "Physics", "Pose", "UserData"):
            if references.get(key):
                names.append(references[key])
        names.extend(expression["File"] for expression in references.get("Expressions", []))
        for motions in references.get("Motions", {}).values():
            for motion in motions:
                names.append(motion["File"])
                if motion.get("Sound"):
                    names.append(motion["Sound"])
        return [(ROOT / manifest.parent / name).resolve().relative_to(ROOT) for name in names]
    except (AttributeError, KeyError, TypeError, ValueError) as error:
        raise ValueError(f"{manifest.as_posix()} のモデル設定を確認してください: {error}") from error


def runtime_files():
    # AI_NOTE: The VTuber browser rig has its own expression images and uses the same motion keys.
    require_files((*PAGES, *MODULES, *MANIFESTS, *VTUBER_FILES))
    assets = {path for manifest in MANIFESTS for path in manifest_files(manifest)}
    require_files(sorted(assets))
    return (*PAGES, *MODULES, *MANIFESTS, *sorted(assets), *VTUBER_FILES)


def install_audio():
    path = ROOT / AUDIO
    if path.exists():
        return False
    # Write the complete WAV before moving it into place so a failed write is retriable.
    with TemporaryDirectory(dir=path.parent) as scratch:
        draft = Path(scratch) / path.name
        with wave.open(str(draft), "wb") as audio:
            rate = 16000
            audio.setparams((1, 2, rate, 0, "NONE", "not compressed"))
            audio.writeframes(bytes(2 * rate * 575 // 100))
        if path.exists():
            return False
        draft.replace(path)
    return True


def check_audio():
    if not (ROOT / AUDIO).is_file():
        raise ValueError(f"{AUDIO.as_posix()} がありません。先に bootstrap.py install を実行してください。")
    try:
        with wave.open(str(ROOT / AUDIO), "rb") as audio:
            if len(audio.readframes(1)) != audio.getnchannels() * audio.getsampwidth():
                raise ValueError("PCM 音声データがありません")
    except (EOFError, wave.Error, ValueError) as error:
        raise ValueError(f"{AUDIO.as_posix()} を PCM WAV として読み込めません。") from error


def check_http(paths):
    handler = partial(QuietPreviewHandler, directory=str(ROOT))
    with ThreadingHTTPServer((HOST, 0), handler) as server:
        worker = Thread(target=server.serve_forever)
        worker.start()
        try:
            with closing(HTTPConnection(HOST, server.server_port, timeout=5)) as client:
                for path in paths:
                    url = "/" if path == Path("index.html") else "/" + quote(path.as_posix())
                    client.request("GET", url)
                    with client.getresponse() as response:
                        mime = response.headers.get_content_type()
                        if response.status != 200 or response.read() != (ROOT / path).read_bytes():
                            raise ValueError(f"HTTP で配信内容を確認できません: {url}")
                        if path.suffix == ".mjs" and mime != "text/javascript":
                            raise ValueError(f"JavaScript の Content-Type が正しくありません: {url}")
        finally:
            server.shutdown()
            worker.join()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("install", help="必要なファイルを確認し、ローカル再生用の WAV を用意する")
    commands.add_parser("check", help="モデル、音声、ローカル HTTP 配信を確認する")
    serve = commands.add_parser("serve", help="この PC のブラウザ向けにデモを起動する")
    serve.add_argument("--port", "-p", type=int, default=PORT, help=f"HTTP ポート（既定 {PORT}）")
    args = parser.parse_args()
    if args.command == "serve" and not 1 <= args.port <= 65535:
        serve.error("--port には 1～65535 を指定してください")

    try:
        paths = runtime_files()
        if args.command == "install":
            status = "無音 WAV を生成" if install_audio() else "既存 WAV を再利用"
            check_audio()
            print(f"PASS {status} | {AUDIO.as_posix()}")
        elif args.command == "check":
            check_audio()
            check_http((*paths, AUDIO))
            print(f"PASS デモ、{len(MANIFESTS)} モデルと参照ファイル、WAV のローカル HTTP 配信")
            print("ブラウザで確認する項目: CDN への接続と WebGL 描画")
        else:
            check_audio()
            handler = partial(PreviewHandler, directory=str(ROOT))
            with ThreadingHTTPServer((HOST, args.port), handler) as server:
                print(f"http://{HOST}:{server.server_port}/  (Ctrl+C で停止)", flush=True)
                server.serve_forever()
    except KeyboardInterrupt:
        return 130
    except (HTTPException, OSError, ValueError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
