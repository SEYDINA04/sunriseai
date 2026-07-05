import { Hero } from "@/components/landing/Hero"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { LanguageGrid } from "@/components/landing/LanguageGrid"
import { HowItWorks } from "@/components/landing/HowItWorks"

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturesSection />
      <HowItWorks />
      <LanguageGrid />
    </>
  )
}
