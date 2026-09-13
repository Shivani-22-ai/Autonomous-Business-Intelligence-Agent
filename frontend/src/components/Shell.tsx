import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  Clock,
  Cpu,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/upload', label: 'Upload Dataset', icon: <Upload size={18} /> },
  { to: '/history', label: 'History', icon: <Clock size={18} /> },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="flex h-full min-h-screen">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col
          bg-surface-800/80 backdrop-blur-xl border-r border-surface-700/50
          transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-700/50">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-violet shadow-glow-brand">
            <Cpu size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">ABI Agent</p>
            <p className="text-[10px] text-surface-400 mt-0.5">Business Intelligence</p>
          </div>
          <button
            className="ml-auto lg:hidden text-surface-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="section-label px-3 mb-3">Navigation</p>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'text-surface-300 hover:bg-surface-700/50 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
              <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Quick action */}
        <div className="p-4 border-t border-surface-700/50">
          <button
            className="btn-primary w-full text-sm"
            onClick={() => { navigate('/upload'); setSidebarOpen(false) }}
          >
            <Upload size={15} />
            New Dataset
          </button>
        </div>

        {/* Mock indicator */}
        {import.meta.env.VITE_USE_MOCK === 'true' && (
          <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-accent-amber/10 border border-accent-amber/25">
            <p className="text-[11px] text-accent-amber font-medium">⚡ Mock Mode</p>
            <p className="text-[10px] text-surface-400 mt-0.5">Set VITE_USE_MOCK=false for live API</p>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 bg-surface-900/80 backdrop-blur-md border-b border-surface-700/40 lg:hidden">
          <button
            className="btn-ghost p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-brand-400" />
            <span className="font-bold text-sm">ABI Agent</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
