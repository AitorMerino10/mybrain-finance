-- Partida "Vehículos" (con subpartidas "Seguro" y "Reparaciones") para todas las familias que ya tienen partidas propias.
-- Es una partida de importe total del periodo ('annual'), igual que Viaje o Excepcional.
-- Idempotente: no duplica nada si ya existe.

do $$
declare
  fam record;
  veh_id uuid;
begin
  for fam in
    select distinct id_family from pml_dim_budget_type where id_family is not null
  loop
    select id_budget_type into veh_id
    from pml_dim_budget_type
    where id_family = fam.id_family
      and lower(ds_budget_type) in ('vehículos', 'vehiculos')
    limit 1;

    if veh_id is null then
      insert into pml_dim_budget_type (ds_budget_type, ds_budget_type_key, ds_periodicity, id_order, id_family)
      values (
        'Vehículos',
        'vehicles_' || substr(fam.id_family::text, 1, 8),
        'annual',
        coalesce((select max(id_order) from pml_dim_budget_type where id_family = fam.id_family), 0) + 1,
        fam.id_family
      )
      returning id_budget_type into veh_id;
    end if;

    -- Subpartidas (solo si ya se ejecutó la migración de subpartidas)
    if to_regclass('public.pml_dim_budget_subtype') is not null then
      insert into pml_dim_budget_subtype (id_family, id_budget_type, ds_budget_subtype, id_order)
      select fam.id_family, veh_id, s.name, s.ord
      from (values ('Seguro', 1), ('Reparaciones', 2)) as s(name, ord)
      where not exists (
        select 1 from pml_dim_budget_subtype x
        where x.id_budget_type = veh_id and lower(x.ds_budget_subtype) = lower(s.name)
      );
    end if;

    veh_id := null;
  end loop;
end $$;
