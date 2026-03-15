import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-center p-6">
      <div className="w-16 h-16 rounded-full bg-maroon-100 flex items-center justify-center mb-2">
        <span className="text-2xl font-bold text-maroon-500">404</span>
      </div>
      <h1 className="text-xl font-bold text-slate-700">Page Not Found</h1>
      <p className="text-sm text-slate-400 max-w-xs">
        The page you are looking for doesn't exist or you don't have access to it.
      </p>
      <Link to="/dashboard">
        <Button variant="primary">
          <Home size={14} />
          Go to Dashboard
        </Button>
      </Link>
    </div>
  )
}
