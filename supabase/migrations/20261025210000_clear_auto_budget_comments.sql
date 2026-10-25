-- Elimina los comentarios que la calculadora generaba automáticamente en los presupuestos
update public.pml_cfg_user_budget
set ds_comments = null
where ds_comments like 'Histórico %'
   or ds_comments like 'Presupuesto de % suma de subcategorías%';
