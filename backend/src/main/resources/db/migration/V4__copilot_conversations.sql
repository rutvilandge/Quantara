CREATE TABLE copilot_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    role VARCHAR(12) NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX copilot_conversation_owner ON copilot_messages(owner_id, conversation_id, created_at);
