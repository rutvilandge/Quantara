CREATE UNIQUE INDEX datasets_one_demo_per_owner ON datasets(owner_id) WHERE is_demo = TRUE;
