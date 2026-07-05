import { HTMLAttributes, forwardRef } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  highlighted?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover = true, highlighted = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-[border-color,transform] duration-300 ease-out ${
          hover ? "hover:-translate-y-0.5 hover:border-white/20" : ""
        } ${highlighted ? "bg-[rgba(50,30,83,0.18)] lg:scale-[1.02]" : ""} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = "Card"
