-- Lugar del pago: el atajo del móvil manda las coordenadas del pago y se guarda un enlace a Google Maps.

alter table pml_pending_transaction
  add column if not exists ft_latitude numeric(9, 6),
  add column if not exists ft_longitude numeric(9, 6);

alter table gnp_fct_transactions
  add column if not exists ds_location_url text;
