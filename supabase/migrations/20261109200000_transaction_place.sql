-- Lugar de la transacción: coordenadas, nombre y dirección (para verlo en un mapa y buscarlo con Google Maps).

alter table gnp_fct_transactions
  add column if not exists ft_latitude numeric(9, 6),
  add column if not exists ft_longitude numeric(9, 6),
  add column if not exists ds_place_name text,
  add column if not exists ds_place_address text,
  add column if not exists ds_place_id text;
