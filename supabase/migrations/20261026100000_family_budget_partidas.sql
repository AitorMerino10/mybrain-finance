-- Partidas presupuestarias propias de cada familia.
--
-- Hasta ahora `pml_dim_budget_type` era una lista global (Fijo, Necesario, Vida, Excepcional, Viaje).
-- Ahora cada familia define sus propias partidas (viaje de verano, seguro del coche, emergencias...).
--   · id_family null  -> plantilla global (se conserva como punto de partida para familias nuevas)
--   · id_family X     -> partida de la familia X
--   · is_archived     -> la partida ya no se ofrece, pero su histórico se conserva
--
-- Las familias que ya tienen datos reciben una COPIA de las partidas globales y todo lo que
-- apuntaba a las globales (gastos, presupuestos guardados, relaciones subcategoría -> partida,
-- fondos, planes de la calculadora) pasa a apuntar a la copia. No se pierde nada.

alter table pml_dim_budget_type
  add column if not exists id_family uuid references pml_dim_family(id_family),
  add column if not exists is_archived boolean not null default false;

create index if not exists idx_budget_type_family on pml_dim_budget_type (id_family);

do $$
declare
  fam record;
  tpl record;
  new_id uuid;
begin
  for fam in
    select distinct f.id_family
    from (
      select id_family from gnp_fct_transactions where id_budget_type is not null
      union select id_family from pml_cfg_user_budget
      union select id_family from pml_rel_subcategory_budget_type
      union select id_family from pml_dim_fund where id_budget_type is not null
      union select id_family from pml_cfg_budget_plan
    ) f
    where f.id_family is not null
  loop
    -- Idempotente: si la familia ya tiene partidas propias no se vuelve a copiar
    if exists (select 1 from pml_dim_budget_type where id_family = fam.id_family) then
      continue;
    end if;

    for tpl in select * from pml_dim_budget_type where id_family is null loop
      insert into pml_dim_budget_type (ds_budget_type, ds_budget_type_key, ds_periodicity, id_order, id_family)
      values (
        tpl.ds_budget_type,
        tpl.ds_budget_type_key || '_' || substr(fam.id_family::text, 1, 8),
        tpl.ds_periodicity,
        tpl.id_order,
        fam.id_family
      )
      returning id_budget_type into new_id;

      update gnp_fct_transactions
        set id_budget_type = new_id
        where id_family = fam.id_family and id_budget_type = tpl.id_budget_type;

      update pml_cfg_user_budget
        set id_budget_type = new_id
        where id_family = fam.id_family and id_budget_type = tpl.id_budget_type;

      update pml_rel_subcategory_budget_type
        set id_budget_type = new_id
        where id_family = fam.id_family and id_budget_type = tpl.id_budget_type;

      update pml_dim_fund
        set id_budget_type = new_id
        where id_family = fam.id_family and id_budget_type = tpl.id_budget_type;

      update pml_rel_fund_link
        set id_budget_type = new_id
        where id_family = fam.id_family and id_budget_type = tpl.id_budget_type;

      -- Los planes de la calculadora guardan el id de la partida como texto (valores y claves del json)
      update pml_cfg_budget_plan
        set js_plan = replace(js_plan::text, tpl.id_budget_type::text, new_id::text)::jsonb
        where id_family = fam.id_family
          and position(tpl.id_budget_type::text in js_plan::text) > 0;
    end loop;
  end loop;
end $$;

-- Seguridad: plantillas visibles para todos, partidas propias solo para los miembros de su familia
alter table pml_dim_budget_type enable row level security;

drop policy if exists "Budget types readable" on pml_dim_budget_type;
create policy "Budget types readable"
  on pml_dim_budget_type
  for select
  using (
    id_family is null
    or exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = pml_dim_budget_type.id_family and uf.id_user = auth.uid()
    )
  );

drop policy if exists "Family members manage own budget types" on pml_dim_budget_type;
create policy "Family members manage own budget types"
  on pml_dim_budget_type
  for all
  using (
    id_family is not null
    and exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = pml_dim_budget_type.id_family and uf.id_user = auth.uid()
    )
  )
  with check (
    id_family is not null
    and exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = pml_dim_budget_type.id_family and uf.id_user = auth.uid()
    )
  );
