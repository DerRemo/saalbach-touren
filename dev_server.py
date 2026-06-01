#!/usr/bin/env python3
"""Dev server that disables HTTP caching so the browser always loads live files.
Run: python3 dev_server.py   (serves the current folder on http://localhost:8000)
"""
import http.server
import socketserver

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Dev server (no-cache) on http://localhost:{PORT}")
    httpd.serve_forever()
