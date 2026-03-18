"""CLI for ledgr."""
import sys, json, argparse
from .core import Ledgr

def main():
    parser = argparse.ArgumentParser(description="Your AI financial controller that never sleeps")
    parser.add_argument("command", nargs="?", default="status", choices=["status", "run", "info"])
    parser.add_argument("--input", "-i", default="")
    args = parser.parse_args()
    instance = Ledgr()
    if args.command == "status":
        print(json.dumps(instance.get_stats(), indent=2))
    elif args.command == "run":
        print(json.dumps(instance.process(input=args.input or "test"), indent=2, default=str))
    elif args.command == "info":
        print(f"ledgr v0.1.0 — Your AI financial controller that never sleeps")

if __name__ == "__main__":
    main()
