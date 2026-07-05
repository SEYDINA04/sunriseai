import { ButtonHTMLAttributes, forwardRef } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => {
    const base =
      "group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-bright focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-950"

    const variants = {
      primary:
        "bg-blue-bright text-white hover:brightness-110 active:brightness-95",
      outline:
        "border border-blue-bright/60 bg-transparent text-blue-bright hover:bg-blue-bright/10 hover:border-blue-bright",
      ghost:
        "border border-white/10 bg-white/[0.03] text-text-muted hover:border-white/25 hover:text-white/90 backdrop-blur-xl",
    }

    const sizes = {
      sm: "px-4 py-2 text-xs",
      md: "px-6 py-3 text-sm",
      lg: "px-8 py-4 text-base",
    }

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"
