import os
import sys
import subprocess
import signal
import shutil


def main() -> None:
    npx = shutil.which("npx")
    if npx is None:
        print(
            "Error: npx not found. Install Node.js (>=18) from https://nodejs.org/",
            file=sys.stderr,
        )
        sys.exit(1)

    cmd = [npx, "-y", "cloudpanel-mcp@latest", *sys.argv[1:]]

    proc = subprocess.Popen(
        cmd,
        stdin=sys.stdin,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    def _signal(signum: int, _frame: object) -> None:
        if proc.poll() is None:
            proc.send_signal(signum)

    signal.signal(signal.SIGINT, _signal)
    signal.signal(signal.SIGTERM, _signal)

    try:
        proc.wait()
    except KeyboardInterrupt:
        if proc.poll() is None:
            proc.terminate()
        proc.wait()

    sys.exit(proc.returncode)


if __name__ == "__main__":
    main()
