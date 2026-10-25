-- Partidas de una sola persona.
--
-- Hasta ahora todas las partidas de la familia valían para todos sus miembros.
--   · id_user null -> partida de toda la familia (como hasta ahora)
--   · id_user X    -> partida solo de esa persona: no se ofrece a los demás en presupuestos, transacciones ni reparto de ingresos
--
-- Idempotente. No cambia ninguna partida existente (todas siguen siendo de la familia).

alter table pml_dim_budget_type
  add column if not exists id_user uuid references pml_dim_user(id_user) on delete set null;

create index if not exists idx_budget_type_user on pml_dim_budget_type (id_user);
