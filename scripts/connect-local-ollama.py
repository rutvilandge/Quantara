"""Run an authenticated, temporary zero-cost Qwen bridge and configure Render.

Requires a logged-in official Render CLI and cloudflared. No secrets are written
to files, arguments, or output. Keep this supervisor running to keep AI online.
"""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]


def render(path, body, method='PUT'):
    config = (Path.home() / '.render' / 'cli.yaml').read_text()
    found = re.search(r'^\s+key:\s*(.+)\s*$', config, re.M)
    if not found:
        raise RuntimeError('Sign in with the official Render CLI first')
    key = found.group(1).strip().strip('"\'')
    request = urllib.request.Request('https://api.render.com/v1' + path, data=json.dumps(body).encode(), method=method,
                                     headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Render returned HTTP {error.code}') from None


def start():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--service-id', required=True)
    parser.add_argument('--cloudflared', required=True)
    args = parser.parse_args()
    token = secrets.token_urlsafe(40)
    environment = dict(os.environ, OLLAMA_GATEWAY_TOKEN=token)
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    gateway = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.ollama_gateway:app', '--host', '127.0.0.1', '--port', '11435', '--workers', '1', '--no-access-log'], cwd=ROOT / 'ml-service', env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
    tunnel = None
    try:
        for attempt in range(30):
            try:
                request = urllib.request.Request('http://127.0.0.1:11435/api/tags', headers={'Authorization': 'Bearer ' + token})
                with urllib.request.urlopen(request, timeout=3) as response:
                    models = json.load(response)
                    if not models.get('models'):
                        raise RuntimeError('Install qwen2.5-coder:3b in Ollama first')
                break
            except OSError:
                if gateway.poll() is not None:
                    raise RuntimeError('The local gateway could not start') from None
                time.sleep(1)
        else:
            raise RuntimeError('Ollama is not reachable locally')
        tunnel = subprocess.Popen([args.cloudflared, 'tunnel', '--url', 'http://127.0.0.1:11435', '--protocol', 'http2', '--no-autoupdate'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, creationflags=flags)
        for line in tunnel.stdout:
            match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
            if match:
                url = match.group(0)
                break
        else:
            raise RuntimeError('The temporary tunnel could not connect')
        for attempt in range(20):
            try:
                request = urllib.request.Request(url + '/api/tags', headers={'Authorization': 'Bearer ' + token})
                with urllib.request.urlopen(request, timeout=10) as response:
                    if not json.load(response).get('models'):
                        raise RuntimeError('The model is not available through the gateway')
                break
            except OSError:
                time.sleep(2)
        else:
            raise RuntimeError('The authenticated model gateway did not become reachable')
        # Prove that the tunnel itself never grants anonymous model access.
        try:
            urllib.request.urlopen(url + '/api/tags', timeout=10)
            raise RuntimeError('Gateway authentication check failed')
        except urllib.error.HTTPError as error:
            if error.code != 401:
                raise RuntimeError('Gateway authentication check failed') from None
        render(f'/services/{args.service_id}/env-vars/OLLAMA_URL', {'value': url})
        render(f'/services/{args.service_id}/env-vars/OLLAMA_API_TOKEN', {'value': token})
        deploy = render(f'/services/{args.service_id}/deploys', {}, 'POST')
        print('Protected Qwen bridge is running. Anonymous access rejected.', flush=True)
        print('Render deployment started:', deploy.get('id'), flush=True)
        print('Keep this computer, Ollama, and this process running. The temporary URL changes on restart.', flush=True)
        # Drain tunnel diagnostics without persisting or exposing request content.
        for _ in tunnel.stdout:
            pass
    finally:
        if tunnel and tunnel.poll() is None:
            tunnel.terminate()
        if gateway.poll() is None:
            gateway.terminate()


if __name__ == '__main__':
    try:
        start()
    except KeyboardInterrupt:
        pass
    except Exception as error:
        print(type(error).__name__ + ': ' + str(error), file=sys.stderr)
        sys.exit(1)
