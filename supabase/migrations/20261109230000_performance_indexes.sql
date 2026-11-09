-- Índices para que las consultas de transacciones sigan siendo rápidas cuando crece el histórico.
-- Idempotente: se puede ejecutar más de una vez.

-- Listados por familia ordenados por fecha (inicio, analítica, presupuestos, mapa)
create index if not exists idx_transactions_family_date
  on gnp_fct_transactions (id_family, dt_date desc, id_transaction);

-- Filtros por mes declarado (gasto del mes en el inicio y los presupuestos)
create index if not exists idx_transactions_family_month
  on gnp_fct_transactions (id_family, ds_month_declared);

-- Las relaciones que se traen junto a cada transacción
create index if not exists idx_rel_transaction_user_tx on pml_rel_transaction_user (id_transaction);
create index if not exists idx_rel_transaction_user_user on pml_rel_transaction_user (id_user);
create index if not exists idx_rel_transaction_tag_tx on pml_rel_transaction_tag (id_transaction);
