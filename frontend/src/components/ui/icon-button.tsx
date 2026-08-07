import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size' | 'aria-label'> {
  label: string
  icon: ReactNode
  size?: Extract<ButtonProps['size'], 'sm' | 'default' | 'lg' | 'icon'>
  showTooltip?: boolean
}

export function IconButton({
  label,
  icon,
  size = 'icon',
  showTooltip = true,
  ...props
}: IconButtonProps) {
  const button = (
    <Button size={size} aria-label={label} {...props}>
      {icon}
    </Button>
  )

  if (!showTooltip) return button

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
