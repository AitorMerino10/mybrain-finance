-- Un mismo cobro recurrente solo puede tener un gasto pendiente.
-- La tarea programada corre cada 10 minutos; sin esta restricción, un fallo al avanzar la regla
-- creaba otra copia en cada pasada.

-- Copias del mismo día: se queda la más antigua
delete from pml_pending_transaction p
where p.id_recurring_expense is not null
  and p.id_pending_transaction in (
    select id_pending_transaction
    from (
      select
        id_pending_transaction,
        row_number() over (
          partition by id_recurring_expense, dt_date
          order by dt_created, id_pending_transaction
        ) as n
      from pml_pending_transaction
      where id_recurring_expense is not null
    ) ranked
    where n > 1
  );

-- Fechas que no son un cobro de la regla (por ejemplo, un pendiente cada día).
-- Si el próximo cobro sigue siendo hoy o anterior, se borran todas: la tarea creará el que toca.
-- Si la regla ya avanzó y ninguna fecha cuadra, se deja la más reciente.
delete from pml_pending_transaction p
using pml_cfg_recurring_expense r
where p.id_recurring_expense = r.id_recurring_expense
  and r.nu_every_months >= 1
  and (
    p.dt_date < r.dt_start
    or (r.dt_end is not null and p.dt_date > r.dt_end)
    or extract(day from p.dt_date)::int <> least(
      r.nu_day_of_month::int,
      extract(day from (date_trunc('month', p.dt_date)::date + interval '1 month' - interval '1 day'))::int
    )
    or mod(
      (extract(year from p.dt_date)::int * 12 + extract(month from p.dt_date)::int)
      - (extract(year from r.dt_start)::int * 12 + extract(month from r.dt_start)::int),
      r.nu_every_months::int
    ) <> 0
  )
  and (
    r.dt_next <= current_date
    or exists (
      select 1
      from pml_pending_transaction ok
      where ok.id_recurring_expense = r.id_recurring_expense
        and ok.id_pending_transaction <> p.id_pending_transaction
        and ok.dt_date >= r.dt_start
        and (r.dt_end is null or ok.dt_date <= r.dt_end)
        and extract(day from ok.dt_date)::int = least(
          r.nu_day_of_month::int,
          extract(day from (date_trunc('month', ok.dt_date)::date + interval '1 month' - interval '1 day'))::int
        )
        and mod(
          (extract(year from ok.dt_date)::int * 12 + extract(month from ok.dt_date)::int)
          - (extract(year from r.dt_start)::int * 12 + extract(month from r.dt_start)::int),
          r.nu_every_months::int
        ) = 0
    )
  );

-- Más de 6 cobros distintos sin confirmar: se queda solo el más reciente.
-- count(distinct) no se puede usar dentro de una ventana; se cuenta aparte.
delete from pml_pending_transaction p
where p.id_pending_transaction in (
  select ranked.id_pending_transaction
  from (
    select
      t.id_pending_transaction,
      t.id_recurring_expense,
      dense_rank() over (partition by t.id_recurring_expense order by t.dt_date desc) as date_rank
    from pml_pending_transaction t
    where t.id_recurring_expense is not null
  ) ranked
  join (
    select id_recurring_expense
    from pml_pending_transaction
    where id_recurring_expense is not null
    group by id_recurring_expense
    having count(distinct dt_date) > 6
  ) flooded on flooded.id_recurring_expense = ranked.id_recurring_expense
  where ranked.date_rank > 1
);

-- Varias filas con id_recurring_expense nulo (pagos del móvil) siguen pudiendo coincidir en fecha:
-- en PostgreSQL los NULL no chocan entre sí en un índice único.
create unique index if not exists uq_pending_recurring_occurrence
  on pml_pending_transaction (id_recurring_expense, dt_date);
