CREATE TABLE datasets (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(150) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    columns_json JSONB NOT NULL,
    rows_json JSONB NOT NULL,
    row_count INTEGER NOT NULL CHECK (row_count >= 0),
    quality_score DOUBLE PRECISION NOT NULL,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX datasets_owner_created ON datasets(owner_id, created_at DESC);

CREATE TABLE workspace_activity (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    kind VARCHAR(40) NOT NULL,
    description VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX activity_owner_created ON workspace_activity(owner_id, created_at DESC);

CREATE TABLE saved_queries (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    sql_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX saved_queries_owner ON saved_queries(owner_id, created_at DESC);

CREATE TABLE query_history (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    question TEXT,
    sql_text TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    duration_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX query_history_owner ON query_history(owner_id, created_at DESC);

CREATE TABLE dashboards (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(150) NOT NULL,
    layout_json JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX dashboards_owner ON dashboards(owner_id, updated_at DESC);

CREATE TABLE account_settings (
    owner_id UUID PRIMARY KEY REFERENCES users(id),
    theme VARCHAR(10) NOT NULL DEFAULT 'system',
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE
);
