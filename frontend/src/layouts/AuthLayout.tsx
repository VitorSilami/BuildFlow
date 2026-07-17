import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="row h-100 m-0">
      <div className="col-lg-5 col-12">
        <div id="auth-left" className="d-flex flex-column justify-content-center h-100 px-4 px-lg-5">
          {children}
        </div>
      </div>
      <div className="col-lg-7 d-none d-lg-block">
        <div id="auth-right" className="h-100" />
      </div>
    </div>
  )
}
