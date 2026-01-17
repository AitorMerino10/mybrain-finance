import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { isAppAdmin } from '@/lib/admin'

type AnalyticsFilters = {
  idFamily: string
  idUsers?: string[] | null
  idCategories?: string[] | null
  idSubcategories?: string[] | null
  idTags?: string[] | null
  monthsDeclared?: string[] | null
  dateFrom?: string | null
  dateTo?: string | null
  startMonth?: string | null
  endMonth?: string | null
  limit?: number | null
  offset?: number | null
}

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = createServerClient()
    const {
      data: { user },
    } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = (await req.json()) as AnalyticsFilters
    if (!body?.idFamily) {
      return NextResponse.json({ error: 'idFamily requerido' }, { status: 400 })
    }

    const isAdmin = isAppAdmin(user.id, user.email || null)

    if (!isAdmin) {
      const { data: member } = await supabaseServer
        .from('pml_rel_user_family')
        .select('id_user')
        .eq('id_user', user.id)
        .eq('id_family', body.idFamily)
        .maybeSingle()

      if (!member) {
        return NextResponse.json({ error: 'Sin acceso a la familia' }, { status: 403 })
      }
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL no configuradas' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const userFilter = body.idUsers && body.idUsers.length > 0
    const tagFilter = body.idTags && body.idTags.length > 0

    const relationsUsers = userFilter
      ? 'pml_rel_transaction_user!inner(id_user, ft_amount_user, pml_dim_user(id_user, ds_user))'
      : 'pml_rel_transaction_user(id_user, ft_amount_user, pml_dim_user(id_user, ds_user))'

    const relationsTags = tagFilter
      ? 'pml_rel_transaction_tag!inner(id_tag, pml_dim_tag(id_tag, ds_tag))'
      : 'pml_rel_transaction_tag(id_tag, pml_dim_tag(id_tag, ds_tag))'

    let query = supabaseAdmin
      .from('gnp_fct_transactions')
      .select(`
        *,
        pml_dim_category(id_category, ds_category),
        pml_dim_subcategory(id_subcategory, ds_subcategory),
        pml_dim_transaction_type(id_type, ds_type),
        ${relationsUsers},
        ${relationsTags}
      `)
      .eq('id_family', body.idFamily)

    if (body.idCategories && body.idCategories.length > 0) {
      query = query.in('id_category', body.idCategories)
    }
    if (body.idSubcategories && body.idSubcategories.length > 0) {
      query = query.in('id_subcategory', body.idSubcategories)
    }
    if (body.monthsDeclared && body.monthsDeclared.length > 0) {
      query = query.in('ds_month_declared', body.monthsDeclared)
    }
    if (body.startMonth) {
      query = query.gte('ds_month_declared', body.startMonth)
    }
    if (body.endMonth) {
      query = query.lte('ds_month_declared', body.endMonth)
    }
    if (body.dateFrom) {
      query = query.gte('dt_date', body.dateFrom)
    }
    if (body.dateTo) {
      query = query.lte('dt_date', body.dateTo)
    }
    if (userFilter) {
      query = query.in('pml_rel_transaction_user.id_user', body.idUsers!)
    }
    if (tagFilter) {
      query = query.in('pml_rel_transaction_tag.id_tag', body.idTags!)
    }
    if (body.limit) {
      const from = body.offset || 0
      query = query.range(from, from + body.limit - 1)
    }

    const { data, error } = await query.order('dt_date', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const mapped = (data || []).map((row: any) => {
      const users = (row.pml_rel_transaction_user || []).map((u: any) => ({
        id_user: u.id_user,
        ds_user: u.pml_dim_user?.ds_user || null,
        ft_amount_user: u.ft_amount_user,
      }))
      const tagRel = (row.pml_rel_transaction_tag || [])[0]
      const adjustedAmount = userFilter
        ? users.reduce((sum: number, u: any) => sum + (u.ft_amount_user || 0), 0)
        : row.ft_amount

      return {
        ...row,
        ft_amount: adjustedAmount,
        category: row.pml_dim_category
          ? {
              id_category: row.pml_dim_category.id_category,
              ds_category: row.pml_dim_category.ds_category,
            }
          : null,
        subcategory: row.pml_dim_subcategory
          ? {
              id_subcategory: row.pml_dim_subcategory.id_subcategory,
              ds_subcategory: row.pml_dim_subcategory.ds_subcategory,
            }
          : null,
        transactionType: row.pml_dim_transaction_type?.ds_type || null,
        tag: tagRel?.pml_dim_tag
          ? {
              id_tag: tagRel.pml_dim_tag.id_tag,
              ds_tag: tagRel.pml_dim_tag.ds_tag,
            }
          : null,
        users,
      }
    })

    return NextResponse.json({ transactions: mapped })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
