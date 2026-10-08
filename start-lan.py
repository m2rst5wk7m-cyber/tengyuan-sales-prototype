#!/usr/bin/env python3
"""Serve this prototype on port 8000 for computers on the same LAN."""
import argparse
import functools
import http.server
import ipaddress
from pathlib import Path
import socket
import threading
import webbrowser


class FreshFileHandler(http.server.SimpleHTTPRequestHandler):
    """Always serve the current file; do not retain HTTP cache copies."""
    def send_head(self):
        # Replaced files can share old timestamps after archive extraction.
        for header in ("If-Modified-Since", "If-None-Match"):
            if header in self.headers:
                del self.headers[header]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def local_addresses():
    addresses = set()
    try:
        for result in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addresses.add(result[4][0])
    except OSError:
        pass
    try:
        # Select the default IPv4 interface; UDP connect sends no packet.
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 80))
            addresses.add(probe.getsockname()[0])
    except OSError:
        pass
    return sorted(address for address in addresses
                  if not ipaddress.ip_address(address).is_loopback
                  and not ipaddress.ip_address(address).is_unspecified)


def main():
    parser = argparse.ArgumentParser(description="Start the local sales prototype.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    root = Path(__file__).resolve().parent / "site"
    if not (root / "index.html").is_file():
        print("Missing site/index.html. Extract the entire ZIP before starting.", flush=True)
        return 1
    handler = functools.partial(FreshFileHandler, directory=str(root))
    try:
        server = http.server.ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    except OSError as error:
        print("Could not start server: " + str(error), flush=True)
        print("If this port is busy, use: python3 start-lan.py --port 8001", flush=True)
        return 1
    with server:
        local_url = "http://127.0.0.1:{}/".format(args.port)
        print("Listening on 0.0.0.0:{} (all network interfaces)".format(args.port), flush=True)
        print("This computer: " + local_url, flush=True)
        print("Serving folder: " + str(root), flush=True)
        print("HTTP cache disabled. Refresh the page after updating files.", flush=True)
        for address in local_addresses():
            print("LAN address: http://{}:{}/".format(address, args.port), flush=True)
        print("Share the LAN address with colleagues on the same network.", flush=True)
        print("Keep this window open. Press Ctrl+C to stop.", flush=True)
        if not args.no_browser:
            timer = threading.Timer(0.5, webbrowser.open, args=(local_url,))
            timer.daemon = True
            timer.start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
