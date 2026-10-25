alter table pml_cfg_user_budget
add column if not exists ds_comments text;

comment on column pml_cfg_user_budget.ds_comments is 'Explicación opcional de cómo se calculó el importe de este presupuesto';
