"""Optional local-only authenticated bridge. Never expose Ollama directly."""
import json
import os
import secrets
import urllib.request
import urllib.error
from threading import BoundedSemaphore
from fastapi import FastAPI, Request, HTTPException
from starlette.responses import Response, StreamingResponse

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
capacity = BoundedSemaphore(1)
MODEL = 'qwen2.5-coder:3b'


@app.middleware('http')
async def authentication(request: Request, call_next):
    expected = os.environ.get('OLLAMA_GATEWAY_TOKEN', '')
    supplied = request.headers.get('authorization', '')
    if not expected or not secrets.compare_digest(supplied, 'Bearer ' + expected):
        return Response(status_code=401)
    length = request.headers.get('content-length', '0')
    if not length.isdigit() or int(length) > 128_000:
        return Response(status_code=413)
    return await call_next(request)


@app.get('/api/tags')
def tags():
    try:
        with urllib.request.urlopen('http://127.0.0.1:11434/api/tags', timeout=3) as response:
            data = json.load(response)
        return {'models': [item for item in data.get('models', []) if item.get('name') == MODEL]}
    except (OSError, ValueError):
        raise HTTPException(503, 'Local model is not available') from None


@app.post('/api/chat')
async def chat(request: Request):
    raw = await request.body()
    if len(raw) > 128_000:
        raise HTTPException(413, 'Request exceeds gateway limit')
    try:
        body = json.loads(raw)
    except ValueError:
        raise HTTPException(400, 'Invalid JSON') from None
    if body.get('model') != MODEL or not isinstance(body.get('messages'), list) or len(body['messages']) > 12:
        raise HTTPException(400, 'Only the configured QUANTARA model is available')
    if not capacity.acquire(blocking=False):
        raise HTTPException(429, 'The local model is busy')
    payload = {'model': MODEL, 'messages': body['messages'], 'stream': bool(body.get('stream', False)),
               'format': 'json', 'keep_alive': '10m',
               'options': {'temperature': 0, 'num_predict': 800, 'num_ctx': 4096}}
    def generate():
        try:
            req = urllib.request.Request('http://127.0.0.1:11434/api/chat', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=120) as response:
                if payload['stream']:
                    for line in response:
                        yield line
                else:
                    yield response.read(256_000)
        finally:
            capacity.release()
    return StreamingResponse(generate(), media_type='application/x-ndjson' if payload['stream'] else 'application/json', headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
