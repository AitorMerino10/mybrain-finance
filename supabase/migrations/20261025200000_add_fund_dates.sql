-- Fechas de vigencia de los fondos: inicio obligatorio, fin opcional (inclusive).
-- El análisis solo tiene en cuenta un fondo entre su fecha de inicio y su fecha de fin.

alter table public.pml_dim_fund
  add column if not exists dt_start_date date,
  add column if not exists dt_end_date date;

-- Los fondos existentes empiezan en su primer movimiento o, si no tienen, el día en que se crearon
update public.pml_dim_fund f
set dt_start_date = coalesce(
  (select min(m.dt_movement)::date from public.gnp_fct_fund_movements m where m.id_fund = f.id_fund),
  f.dt_created::date
)
where f.dt_start_date is null;

alter table public.pml_dim_fund
  alter column dt_start_date set not null,
  alter column dt_start_date set default current_date;

alter table public.pml_dim_fund
  drop constraint if exists ck_fund_dates;

alter table public.pml_dim_fund
  add constraint ck_fund_dates check (dt_end_date is null or dt_end_date >= dt_start_date);

comment on column public.pml_dim_fund.dt_start_date is 'Fecha desde la que el fondo está vigente (obligatoria)';
comment on column public.pml_dim_fund.dt_end_date is 'Última fecha en la que el fondo está vigente (opcional)';
