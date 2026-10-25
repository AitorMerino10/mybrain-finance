import { redirect } from 'next/navigation'

// Los fondos ya no existen: el dinero reservado se gestiona con las partidas del presupuesto
export default function FundsPage({ searchParams }: { searchParams: { family?: string } }) {
  redirect(searchParams.family ? `/budgets?family=${searchParams.family}` : '/budgets')
}
