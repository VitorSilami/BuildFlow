import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function DashboardLayout() {
  return (
    <div id="app">
      <div id="sidebar">
        <Sidebar />
      </div>
      <div id="main">
        <Topbar />
        <div className="page-content px-3">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  )
}
