import { Link } from 'react-router-dom'

interface Breadcrumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs: Breadcrumb[]
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="page-heading">
      <div className="page-title">
        <div className="row align-items-center">
          <div className="col-12 col-md-6 order-md-1 order-last">
            <h3>{title}</h3>
            {subtitle && <p className="text-subtitle text-muted">{subtitle}</p>}
          </div>
          <div className="col-12 col-md-6 order-md-2 order-first d-flex justify-content-md-end align-items-center gap-2">
            <nav aria-label="breadcrumb" className="breadcrumb-header float-start float-lg-end">
              <ol className="breadcrumb mb-0">
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1
                  return (
                    <li
                      key={crumb.label}
                      className={`breadcrumb-item${isLast ? ' active' : ''}`}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {crumb.to && !isLast ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
                    </li>
                  )
                })}
              </ol>
            </nav>
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
