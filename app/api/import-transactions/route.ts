import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { isAppAdmin } from '@/lib/admin'

type CsvRow = {
  fecha: string
  categoria: string
  subcategoria: string
  cantidad: string
  comentario: string
  mes_declarado: string
  personas_afectadas?: string
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseAmount(value: string): number | null {
  if (!value) return null
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

function parseMonthDeclared(value: string): string | null {
  const v = value.trim()
  if (/^\d{4}-\d{2}$/.test(v)) return v
  if (/^\d{2}-\d{4}$/.test(v)) {
    const [mm, yyyy] = v.split('-')
    return `${yyyy}-${mm}`
  }
  return null
}

function splitAmount(total: number, userCount: number): number[] {
  if (userCount <= 1) return [total]
  const base = Math.floor((total / userCount) * 100) / 100
  const amounts: number[] = []
  let sum = 0
  for (let i = 0; i < userCount - 1; i++) {
    amounts.push(base)
    sum += base
  }
  amounts.push(Math.round((total - sum) * 100) / 100)
  return amounts
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
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

    const body = await req.json()
    const {
      idFamily,
      idType,
      defaultUserIds = [],
      rows = [],
      useCsvUsers = true,
    } = body as {
      idFamily: string
      idType: string
      defaultUserIds: string[]
      rows: CsvRow[]
      useCsvUsers: boolean
    }

    if (!idFamily || !idType || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const isAdmin = isAppAdmin(user.id, user.email || null)

    if (!isAdmin) {
      const { data: member } = await supabaseServer
        .from('pml_rel_user_family')
        .select('id_user')
        .eq('id_user', user.id)
        .eq('id_family', idFamily)
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

    const { data: membersData, error: membersError } = await supabaseAdmin
      .from('pml_rel_user_family')
      .select('id_user, pml_dim_user(id_user, ds_user, ds_email)')
      .eq('id_family', idFamily)

    if (membersError || !membersData) {
      return NextResponse.json({ error: 'No se pudo obtener miembros de familia' }, { status: 500 })
    }

    const members = membersData.map((m: any) => ({
      id_user: m.id_user,
      ds_user: m.pml_dim_user?.ds_user || '',
      ds_email: m.pml_dim_user?.ds_email || '',
    }))

    const memberIds = new Set(members.map(m => m.id_user))
    const memberLookup = new Map<string, string>()

    members.forEach(m => {
      if (m.ds_user) memberLookup.set(normalizeText(m.ds_user), m.id_user)
      if (m.ds_email) memberLookup.set(normalizeText(m.ds_email), m.id_user)
    })

    for (const id of defaultUserIds) {
      if (!memberIds.has(id)) {
        return NextResponse.json({ error: 'Usuarios inválidos para la familia' }, { status: 400 })
      }
    }

    const { data: categories } = await supabaseAdmin
      .from('pml_dim_category')
      .select('id_category, ds_category')
      .eq('id_family', idFamily)

    const categoryMap = new Map<string, string>()
    ;(categories || []).forEach(c => {
      categoryMap.set(normalizeText(c.ds_category), c.id_category)
    })

    const categoryIds = (categories || []).map(c => c.id_category)
    const { data: subcategories } = await supabaseAdmin
      .from('pml_dim_subcategory')
      .select('id_subcategory, ds_subcategory, id_category')
      .in('id_category', categoryIds)

    const subcategoryMap = new Map<string, string>()
    ;(subcategories || []).forEach(s => {
      const key = `${s.id_category}::${normalizeText(s.ds_subcategory)}`
      subcategoryMap.set(key, s.id_subcategory)
    })

    const errors: Array<{ row: number; error: string; data: CsvRow }> = []
    const prepared: Array<{
      rowIndex: number
      transaction: Database['public']['Tables']['gnp_fct_transactions']['Insert']
      userIds: string[]
    }> = []

    rows.forEach((row, index) => {
      const rowNumber = index + 2

      const amount = parseAmount(row.cantidad)
      if (amount === null) {
        errors.push({ row: rowNumber, error: 'Cantidad inválida', data: row })
        return
      }

      const monthDeclared = parseMonthDeclared(row.mes_declarado)
      if (!monthDeclared) {
        errors.push({ row: rowNumber, error: 'Mes declarado inválido', data: row })
        return
      }

      const categoryId = categoryMap.get(normalizeText(row.categoria))
      if (!categoryId) {
        errors.push({ row: rowNumber, error: 'Categoría no encontrada', data: row })
        return
      }

      let subcategoryId: string | null = null
      if (row.subcategoria && row.subcategoria.trim() !== '') {
        const subKey = `${categoryId}::${normalizeText(row.subcategoria)}`
        subcategoryId = subcategoryMap.get(subKey) || null
        if (!subcategoryId) {
          errors.push({ row: rowNumber, error: 'Subcategoría no encontrada', data: row })
          return
        }
      }

      let rowUserIds: string[] = defaultUserIds

      if (useCsvUsers && row.personas_afectadas) {
        const raw = normalizeText(row.personas_afectadas)
        if (raw === 'conjunta' || raw === 'todos' || raw === 'todas') {
          rowUserIds = Array.from(memberIds)
        } else {
          const parts = raw.split('|').map(p => p.trim()).filter(Boolean)
          const resolved: string[] = []
          for (const part of parts) {
            const id = memberLookup.get(part)
            if (id) resolved.push(id)
          }
          if (resolved.length === 0) {
            errors.push({ row: rowNumber, error: 'Personas no reconocidas', data: row })
            return
          }
          rowUserIds = resolved
        }
      }

      if (!rowUserIds || rowUserIds.length === 0) {
        errors.push({ row: rowNumber, error: 'Sin personas afectadas', data: row })
        return
      }

      prepared.push({
        rowIndex: rowNumber,
        userIds: rowUserIds,
        transaction: {
          id_family: idFamily,
          id_type: idType,
          id_category: categoryId,
          id_subcategory: subcategoryId,
          ft_amount: amount,
          dt_date: row.fecha,
          ds_month_declared: monthDeclared,
          ds_comments: row.comentario || null,
          id_user_creator: user.id,
        },
      })
    })

    if (prepared.length === 0) {
      return NextResponse.json({ inserted: 0, errors })
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('gnp_fct_transactions')
      .insert(prepared.map(p => p.transaction))
      .select('id_transaction, ft_amount')

    if (insertError || !inserted) {
      return NextResponse.json({ error: 'Error al insertar transacciones' }, { status: 500 })
    }

    const relations: Database['public']['Tables']['pml_rel_transaction_user']['Insert'][] = []

    inserted.forEach((t, i) => {
      const users = prepared[i].userIds
      const amounts = splitAmount(prepared[i].transaction.ft_amount as number, users.length)
      users.forEach((id_user, idx) => {
        relations.push({
          id_transaction: t.id_transaction,
          id_user,
          ft_amount_user: amounts[idx],
        })
      })
    })

    for (const part of chunk(relations, 1000)) {
      const { error: relError } = await supabaseAdmin
        .from('pml_rel_transaction_user')
        .insert(part)
      if (relError) {
        return NextResponse.json({ error: 'Error al insertar relaciones' }, { status: 500 })
      }
    }

    return NextResponse.json({
      inserted: inserted.length,
      errors,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
