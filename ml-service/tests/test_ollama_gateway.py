from fastapi.testclient import TestClient
from app.ollama_gateway import app


def test_gateway_denies_anonymous_and_wrong_tokens(monkeypatch):
    monkeypatch.setenv('OLLAMA_GATEWAY_TOKEN', 'gateway-test-only-token')
    client = TestClient(app)
    assert client.get('/api/tags').status_code == 401
    assert client.post('/api/chat', json={}).status_code == 401
    assert client.get('/api/tags', headers={'Authorization': 'Bearer wrong'}).status_code == 401


def test_gateway_restricts_models_routes_and_body_size(monkeypatch):
    monkeypatch.setenv('OLLAMA_GATEWAY_TOKEN', 'gateway-test-only-token')
    client = TestClient(app)
    headers = {'Authorization': 'Bearer gateway-test-only-token'}
    assert client.post('/api/chat', headers=headers, json={'model': 'unapproved', 'messages': []}).status_code == 400
    assert client.post('/api/pull', headers=headers, json={'model': 'anything'}).status_code == 404
    assert client.post('/api/chat', headers=headers, content='x' * 128_001).status_code == 413
