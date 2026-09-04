export type NavView = 'home' | 'program' | 'history' | 'lift-tracker' | 'nutrition'

export function BottomNav({ active, onNavigate }: { active: NavView; onNavigate: (view: NavView) => void }) {
  const items: { view: NavView; label: string }[] = [
    { view: 'home', label: 'Home' },
    { view: 'program', label: 'Program' },
    { view: 'history', label: 'History' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <button
          key={item.view}
          onClick={() => onNavigate(item.view)}
          className={`flex-1 py-3 text-sm font-medium ${active === item.view ? 'font-semibold text-text' : 'text-text-muted'}`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
